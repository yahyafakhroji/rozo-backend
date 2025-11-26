/**
 * Payment Callback Function
 * Handles Daimo Pay webhooks for payment status updates
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, PaymentStatus, STATUS_HIERARCHY } from "../../_shared/config/index.ts";

// Services
import { sendNotificationToDevices } from "../../_shared/services/notification.service.ts";

// Local pusher notification
import { pushNotification } from "./pusher.ts";

// Types
import type { DaimoWebhookEvent } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/payment-callback");

// Apply CORS
app.use("*", cors(corsConfig));

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
  webhook: DaimoWebhookEvent,
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
 * Handles specific logic for each webhook type
 */
async function handleWebhookType(
  supabase: unknown,
  webhook: DaimoWebhookEvent,
  order: OrderRecord,
): Promise<void> {
  const orderId = order.order_id || order.deposit_id;
  let webhookEvent = webhook.event;

  if (webhook.event === "payment.completed") {
    webhookEvent = "payment_completed";
  }

  switch (webhookEvent) {
    case "payment_started":
      console.log(
        `Payment started for order ${orderId}: source tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      break;

    case "payment_completed": {
      console.log(
        `Payment completed for order ${orderId}: destination tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );

      // Send Firebase Notification only for orders
      if (order.order_id) {
        const { data: devices, error: devicesError } = await (supabase as any)
          .from("merchant_devices")
          .select("fcm_token")
          .eq("merchant_id", order.merchant_id);

        if (devicesError || !devices || devices.length === 0) {
          console.error("Failed to fetch devices:", devicesError);
        } else if (devices && devices.length > 0) {
          const tokens = devices?.map((d: { fcm_token: string }) => d.fcm_token) || [];

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

      const paymentCompletedNotification = await pushNotification(
        order.merchant_id,
        webhookEvent,
        {
          message: "Payment completed",
          order_id: orderId,
          display_currency: order.display_currency,
          display_amount: order.display_amount,
        },
      );
      if (!paymentCompletedNotification.success) {
        console.error(
          "Failed to Send Payment Notification:",
          paymentCompletedNotification.error,
        );
      }
      break;
    }

    case "payment_bounced":
      console.log(
        `Payment bounced for order ${orderId}: tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      break;

    case "payment_refunded": {
      console.log(
        `Payment refunded for order ${orderId}: tx ${webhook.payment.metadata?.transaction_hash} on chain ${webhook.payment.payinchainid}`,
      );
      const paymentRefundNotification = await pushNotification(
        order.merchant_id,
        webhookEvent,
        {
          message: "Payment Refunded",
          order_id: orderId,
          display_currency: order.display_currency,
          display_amount: order.display_amount,
        },
      );
      if (!paymentRefundNotification.success) {
        console.error(
          "Failed to Send Payment Notification:",
          paymentRefundNotification.error,
        );
      }
      break;
    }

    default:
      console.warn(`Unhandled webhook type: ${webhookEvent}`);
  }
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * POST /payment-callback - Handle Daimo Pay webhook
 */
app.post("/", async (c) => {
  try {
    // Initialize Supabase client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Parse webhook payload
    const webhookEvent: DaimoWebhookEvent = await c.req.json();
    console.log(webhookEvent);
    console.log(
      `Received webhook: ${webhookEvent.event} for payment ${webhookEvent.payment.id}`,
    );

    // Validate required fields
    if (
      !webhookEvent.event ||
      !webhookEvent.payment ||
      !webhookEvent.payment.id ||
      !webhookEvent.payment.metadata?.merchantToken
    ) {
      const missingFields = [];
      if (!webhookEvent.event) missingFields.push("event");
      if (!webhookEvent.payment) missingFields.push("payment");
      if (!webhookEvent.payment?.id) missingFields.push("payment.id");
      if (!webhookEvent.payment?.metadata?.merchantToken) {
        missingFields.push("payment.metadata.merchantToken");
      }
      console.error(
        `Invalid webhook payload: missing required fields: ${missingFields.join(", ")}`,
      );
      return c.text("Invalid payload", 400);
    }

    // Find order or deposit by number using metadata.orderNumber
    let existingOrder: OrderRecord | null = null;
    let tableName = "orders";
    const orderNumber = webhookEvent.payment.metadata?.orderNumber;

    if (!orderNumber) {
      console.error("Missing orderNumber in webhook metadata");
      return c.text("Missing order number", 400);
    }

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

    if (!existingOrder) {
      const { data: existingDeposit, error: fetchErrorDeposit } = await supabase
        .from("deposits")
        .select("*")
        .eq("number", orderNumber)
        .single();

      if (fetchErrorDeposit && fetchErrorDeposit.code !== "PGRST116") {
        console.error("Database error fetching deposit:", fetchErrorDeposit);
        return c.text("Database error", 500);
      }

      tableName = "deposits";
      existingOrder = existingDeposit as OrderRecord;
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

    // Check if this status transition is allowed
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

    // If status is the same, check if this is a duplicate webhook
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
      source_token_amount: Number(webhookEvent.payment.metadata?.actual_amount),
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
      `Successfully updated order ${
        tableName === "orders" ? existingOrder.order_id : existingOrder.deposit_id
      } status from ${currentStatus} to ${newStatus}`,
    );

    // Handle specific webhook types
    await handleWebhookType(supabase, webhookEvent, existingOrder);

    return c.text("Webhook processed successfully", 200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.text("Internal server error", 500);
  }
});

// Not allowed methods
app.all("*", (c) => c.text("Method not allowed", 405));

// Export for Deno
Deno.serve(app.fetch);
