/**
 * Payment Callback Function
 * Handles Daimo Pay webhooks for payment status updates
 * Refactored with webhook verification, Zod validation, and audit logging
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, PaymentStatus, STATUS_HIERARCHY } from "../../_shared/config/index.ts";

// Middleware
import { errorMiddleware } from "../../_shared/middleware/index.ts";

// Services
import { sendNotificationToDevices } from "../../_shared/services/notification.service.ts";
import {
  logOrderEvent,
  AuditAction,
} from "../../_shared/services/audit.service.ts";

// Schemas
import {
  DaimoWebhookEventSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Utils
import { createSupabaseClient } from "../../_shared/utils/supabase.utils.ts";
import {
  verifyDaimoWebhook,
  extractRawBody,
} from "../../_shared/utils/webhook.utils.ts";

// Local pusher notification
import { pushNotification } from "./pusher.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { DaimoWebhookEventInput } from "../../_shared/schemas/index.ts";

const app = new Hono().basePath("/payment-callback");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);

// ============================================================================
// Types
// ============================================================================

interface OrderRecord {
  order_id: string;
  merchant_id: string;
  payment_id: string;
  status: PaymentStatus;
  callback_payload: unknown;
  display_currency: string;
  display_amount: number;
  merchant_chain_id: string;
  merchant_address: string;
  required_token: string;
  required_amount_usd: number;
  created_at: string;
  updated_at: string;
  source_txn_hash: string;
  source_chain_name: string;
  source_token_address: string;
  source_token_amount: number;
  number: string;
  deposit_id?: string;
}

interface DeviceRecord {
  fcm_token: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps Daimo webhook event types to payment status enum
 */
function mapWebhookTypeToStatus(webhookType: string): PaymentStatus {
  switch (webhookType) {
    case "payment_started":
      return PaymentStatus.PROCESSING;
    case "payment.completed":
    case "payment_completed":
      return PaymentStatus.COMPLETED;
    case "payment_bounced":
      return PaymentStatus.DISCREPANCY;
    case "payment_refunded":
      return PaymentStatus.FAILED;
    default:
      throw new Error(`Unknown webhook type: ${webhookType}`);
  }
}

/**
 * Validates that the webhook payment details match the stored order
 */
function validatePaymentDetails(
  order: OrderRecord,
  webhook: DaimoWebhookEventInput,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate merchant token
  if (order.merchant_address !== webhook.payment.metadata?.merchantToken) {
    errors.push(
      `Merchant token mismatch: expected ${order.merchant_address}, got ${webhook.payment.metadata?.merchantToken}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get normalized webhook event type
 */
function normalizeWebhookEvent(event: string): string {
  if (event === "payment.completed") {
    return "payment_completed";
  }
  return event;
}

/**
 * Send notifications for completed payments
 */
async function sendPaymentNotifications(
  supabase: TypedSupabaseClient,
  order: OrderRecord,
  webhookEvent: string,
): Promise<void> {
  const orderId = order.order_id || order.deposit_id;
  const normalizedEvent = normalizeWebhookEvent(webhookEvent);

  // Send Firebase Notification only for orders
  if (order.order_id) {
    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("fcm_token")
      .eq("merchant_id", order.merchant_id);

    if (devicesError || !devices || devices.length === 0) {
      console.error("Failed to fetch devices:", devicesError);
    } else {
      const deviceRecords = devices as DeviceRecord[];
      const tokens = deviceRecords.map((d) => d.fcm_token);

      try {
        const result = await sendNotificationToDevices(
          tokens,
          "Payment Received",
          `You received ${order.display_currency} ${order.display_amount} from Order #${order.number}`,
          {
            orderId: orderId,
            type: "PAYMENT_RECEIVED",
            action: "OPEN_BALANCE",
            deepLink: "rozo://balance",
          },
        );

        if (result?.failureCount > 0) {
          console.log(
            `Failed to send to ${result.failureCount} devices: ${JSON.stringify(result.responses)}`,
          );
        }
      } catch (error) {
        console.error("Failed to send notification:", error);
      }
    }
  }

  // Send Pusher notification
  const pushNotificationResult = await pushNotification(
    order.merchant_id,
    normalizedEvent,
    {
      message: normalizedEvent === "payment_completed" ? "Payment completed" : "Payment refunded",
      order_id: orderId,
      display_currency: order.display_currency,
      display_amount: order.display_amount,
    },
  );

  if (!pushNotificationResult.success) {
    console.error("Failed to send Pusher notification:", pushNotificationResult.error);
  }
}

/**
 * Handles specific logic for each webhook type
 */
async function handleWebhookType(
  supabase: TypedSupabaseClient,
  webhook: DaimoWebhookEventInput,
  order: OrderRecord,
): Promise<void> {
  const orderId = order.order_id || order.deposit_id;
  const normalizedEvent = normalizeWebhookEvent(webhook.event);

  switch (normalizedEvent) {
    case "payment_started":
      console.log(
        `Payment started for order ${orderId}: source tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      break;

    case "payment_completed":
      console.log(
        `Payment completed for order ${orderId}: destination tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      await sendPaymentNotifications(supabase, order, webhook.event);
      break;

    case "payment_bounced":
      console.log(
        `Payment bounced for order ${orderId}: tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      break;

    case "payment_refunded":
      console.log(
        `Payment refunded for order ${orderId}: tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      await sendPaymentNotifications(supabase, order, webhook.event);
      break;

    default:
      console.warn(`Unhandled webhook type: ${normalizedEvent}`);
  }
}

/**
 * Log payment status change to audit log
 */
function logPaymentStatusChange(
  supabase: TypedSupabaseClient,
  order: OrderRecord,
  oldStatus: PaymentStatus,
  newStatus: PaymentStatus,
  webhook: DaimoWebhookEventInput,
): void {
  // Determine the appropriate audit action
  let action: AuditAction;
  switch (newStatus) {
    case PaymentStatus.COMPLETED:
      action = order.order_id ? AuditAction.ORDER_COMPLETED : AuditAction.DEPOSIT_COMPLETED;
      break;
    case PaymentStatus.FAILED:
    case PaymentStatus.DISCREPANCY:
      action = order.order_id ? AuditAction.ORDER_FAILED : AuditAction.DEPOSIT_FAILED;
      break;
    default:
      return; // Don't log intermediate states
  }

  const resourceId = order.order_id || order.deposit_id || "";

  logOrderEvent(supabase, order.merchant_id, resourceId, action, {
    previousStatus: oldStatus,
    newStatus: newStatus,
    paymentId: webhook.payment.id,
    txHash: webhook.payment.metadata?.transaction_hash,
    amount: order.display_amount,
    currency: order.display_currency,
  });
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * POST /payment-callback - Handle Daimo Pay webhook
 */
app.post("/", async (c) => {
  // Extract raw body for signature verification
  const rawBody = await extractRawBody(c.req.raw);

  // Verify webhook signature (if secret is configured)
  const verificationResult = await verifyDaimoWebhook(rawBody, c.req.raw.headers);

  if (!verificationResult.valid) {
    console.error("Webhook verification failed:", verificationResult.error);
    return c.text("Unauthorized", 401);
  }

  // Initialize Supabase client
  const supabase = createSupabaseClient() as TypedSupabaseClient;

  // Parse and validate webhook payload using Zod
  const validation = safeParseBody(DaimoWebhookEventSchema, JSON.parse(rawBody));

  if (!validation.success) {
    console.error("Invalid webhook payload:", validation.error);
    return c.text(`Invalid payload: ${validation.error}`, 400);
  }

  const webhookEvent = validation.data;
  console.log(`Received webhook: ${webhookEvent.event} for payment ${webhookEvent.payment.id}`);

  // Extract order number from metadata
  const orderNumber = webhookEvent.payment.metadata?.orderNumber;
  if (!orderNumber) {
    console.error("Missing orderNumber in webhook metadata");
    return c.text("Missing order number", 400);
  }

  // Find order or deposit by number
  let existingOrder: OrderRecord | null = null;
  let tableName = "orders";

  const { data: orderData, error: fetchError } = await supabase
    .from(tableName)
    .select("*")
    .eq("number", orderNumber)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Database error fetching order:", fetchError);
    return c.text("Database error", 500);
  }

  if (orderData) {
    existingOrder = orderData as OrderRecord;
  }

  // Try deposits if order not found
  if (!existingOrder) {
    const { data: depositData, error: depositError } = await supabase
      .from("deposits")
      .select("*")
      .eq("number", orderNumber)
      .single();

    if (depositError && depositError.code !== "PGRST116") {
      console.error("Database error fetching deposit:", depositError);
      return c.text("Database error", 500);
    }

    if (depositData) {
      tableName = "deposits";
      existingOrder = depositData as OrderRecord;
    }
  }

  if (!existingOrder) {
    console.error(`No order or deposit found for number: ${orderNumber}`);
    return c.text("Order not found", 404);
  }

  // Validate payment details match order
  const validationResult = validatePaymentDetails(existingOrder, webhookEvent);
  if (!validationResult.isValid) {
    console.error("Payment validation failed:", validationResult.errors);
    return c.text(`Validation failed: ${validationResult.errors.join(", ")}`, 400);
  }

  // Check if status transition is allowed
  const newStatus = mapWebhookTypeToStatus(webhookEvent.event);
  const currentStatus = existingOrder.status as PaymentStatus;

  const currentStatusLevel = STATUS_HIERARCHY[currentStatus];
  const newStatusLevel = STATUS_HIERARCHY[newStatus];

  // Prevent backward transitions
  if (newStatusLevel < currentStatusLevel) {
    console.log(
      `Ignoring backward status transition from ${currentStatus} to ${newStatus} for payment ${webhookEvent.payment.id}`,
    );
    return c.text("Status transition ignored", 200);
  }

  // If status is the same, treat as duplicate webhook
  if (currentStatus === newStatus) {
    console.log(
      `Duplicate webhook received for payment ${webhookEvent.payment.id} with status ${newStatus} for ${tableName}: ${orderNumber}`,
    );
    return c.text("Duplicate webhook ignored", 200);
  }

  // Prepare update data
  const updateData = {
    status: newStatus,
    callback_payload: webhookEvent,
    source_txn_hash: webhookEvent.payment.metadata?.transaction_hash,
    source_chain_name: webhookEvent.payment.payinchainid,
    source_token_address: webhookEvent.payment.payintokenaddress,
    source_token_amount: Number(webhookEvent.payment.metadata?.actual_amount || 0),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from(tableName)
    .update(updateData)
    .eq("number", orderNumber);

  if (updateError) {
    const recordType = tableName === "orders" ? "order" : "deposit";
    console.error(`Error updating ${recordType}:`, updateError);
    return c.text(`Failed to update ${recordType}`, 500);
  }

  console.log(
    `Successfully updated ${tableName === "orders" ? "order" : "deposit"} ${
      existingOrder.order_id || existingOrder.deposit_id
    } status from ${currentStatus} to ${newStatus}`,
  );

  // Log status change to audit log
  logPaymentStatusChange(supabase, existingOrder, currentStatus, newStatus, webhookEvent);

  // Handle specific webhook types (notifications, etc.)
  await handleWebhookType(supabase, webhookEvent, existingOrder);

  return c.text("Webhook processed successfully", 200);
});

// Not allowed methods
app.all("*", (c) => c.text("Method not allowed", 405));

// Export for Deno
Deno.serve(app.fetch);
