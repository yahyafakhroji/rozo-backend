/**
 * Orders Function
 * Handles order creation, retrieval, and payment regeneration
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, CONSTANTS } from "../../_shared/config/index.ts";

// Middleware
import {
  dualAuthMiddleware,
  errorMiddleware,
  notFoundHandler,
} from "../../_shared/middleware/index.ts";

// Services
import {
  validateMerchant,
  resolvePreferredToken,
  getDestinationAddress,
} from "../../_shared/services/merchant.service.ts";
import { convertCurrencyToUSD } from "../../_shared/services/currency.service.ts";
import { createOrderPaymentLink } from "../../_shared/services/payment.service.ts";

// Utils
import { generateOrderNumber } from "../../_shared/utils/helpers.ts";

// Validators
import {
  validatePaginationParams,
  validateStatusFilter,
} from "../../_shared/validators/common.validator.ts";
import { validateCreateOrderRequest } from "../../_shared/validators/order.validator.ts";

// Types
import type { MerchantData, TokenData } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/orders");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Insert order record into database
 */
async function insertOrderRecord(
  supabase: any,
  orderData: {
    display_currency: string;
    display_amount: number;
    description?: string;
    preferred_token_id?: string;
  },
  merchant: MerchantData,
  orderNumber: string,
  paymentDetail: any,
  formattedUsdAmount: number,
  destinationToken: TokenData,
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CONSTANTS.ORDER.EXPIRY_MINUTES * 60 * 1000,
  );

  const destinationAddress = getDestinationAddress(merchant);
  if (!destinationAddress) {
    return { success: false, error: "Destination address not found" };
  }

  const orderToInsert = {
    number: orderNumber,
    merchant_id: merchant.merchant_id,
    payment_id: paymentDetail.id,
    merchant_chain_id: destinationToken.chain_id,
    merchant_address: destinationAddress,
    required_amount_usd: formattedUsdAmount,
    required_token: destinationToken.token_address,
    preferred_token_id: orderData.preferred_token_id,
    display_currency: orderData.display_currency,
    display_amount: orderData.display_amount,
    description: orderData.description,
    status: CONSTANTS.STATUS.PAYMENT.PENDING,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expired_at: expiresAt.toISOString(),
    payment_data: paymentDetail,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderToInsert)
    .select()
    .single();

  if (orderError) {
    return { success: false, error: orderError.message };
  }

  return { success: true, order };
}

/**
 * Create a new order
 */
async function createOrder(
  supabase: any,
  userProviderId: string,
  isPrivyAuth: boolean,
  orderData: {
    display_currency: string;
    display_amount: number;
    description?: string;
    preferred_token_id?: string;
  },
) {
  // Step 1: Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    return merchantResult;
  }

  // Step 2: Convert currency to USD
  const conversionResult = await convertCurrencyToUSD(
    supabase,
    orderData.display_currency,
    orderData.display_amount,
  );
  if (!conversionResult.success || !conversionResult.usdAmount) {
    return conversionResult;
  }

  // Step 3: Resolve destination token (merchant's default)
  const destinationTokenResult = await resolvePreferredToken(
    supabase,
    merchantResult.merchant.default_token_id,
  );
  if (!destinationTokenResult.success || !destinationTokenResult.token) {
    return destinationTokenResult;
  }

  // Step 4: Resolve preferred token (user's choice or default)
  const preferredTokenResult = await resolvePreferredToken(
    supabase,
    merchantResult.merchant.default_token_id,
    orderData.preferred_token_id,
  );
  if (!preferredTokenResult.success || !preferredTokenResult.token) {
    return preferredTokenResult;
  }

  // Step 5: Generate order number
  const orderNumber = generateOrderNumber();

  // Step 6: Create payment link
  const paymentResult = await createOrderPaymentLink(
    merchantResult.merchant,
    orderData,
    orderNumber,
    conversionResult.usdAmount,
    destinationTokenResult.token,
    preferredTokenResult.token,
  );
  if (!paymentResult.success || !paymentResult.paymentDetail) {
    return paymentResult;
  }

  // Step 7: Insert order record
  const insertResult = await insertOrderRecord(
    supabase,
    orderData,
    merchantResult.merchant,
    orderNumber,
    paymentResult.paymentDetail,
    conversionResult.usdAmount,
    destinationTokenResult.token,
  );
  if (!insertResult.success || !insertResult.order) {
    return insertResult;
  }

  return {
    success: true,
    paymentDetail: paymentResult.paymentDetail,
    order_id: insertResult.order.order_id,
    order_number: insertResult.order.number,
    expired_at: insertResult.order.expired_at,
  };
}

/**
 * Regenerate payment link for existing PENDING order
 */
async function regeneratePaymentLink(
  supabase: any,
  orderId: string,
  userProviderId: string,
  isPrivyAuth: boolean,
  newPreferredTokenId?: string,
) {
  // Step 1: Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    return merchantResult;
  }

  // Step 2: Get order details
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("merchant_id", merchantResult.merchant.merchant_id)
    .single();

  if (orderError || !order) {
    return {
      success: false,
      error: "Order not found or does not belong to merchant",
    };
  }

  // Step 3: Validate order status
  if (order.status !== CONSTANTS.STATUS.PAYMENT.PENDING) {
    return {
      success: false,
      error: `Cannot regenerate payment for order with status: ${order.status}. Only PENDING orders can regenerate payment.`,
    };
  }

  // Step 4: Determine preferred token
  const preferredTokenIdToUse = newPreferredTokenId ?? order.preferred_token_id;

  // Step 5: Resolve tokens
  const destinationTokenResult = await resolvePreferredToken(
    supabase,
    merchantResult.merchant.default_token_id,
  );
  if (!destinationTokenResult.success || !destinationTokenResult.token) {
    return destinationTokenResult;
  }

  const preferredTokenResult = await resolvePreferredToken(
    supabase,
    merchantResult.merchant.default_token_id,
    preferredTokenIdToUse,
  );
  if (!preferredTokenResult.success || !preferredTokenResult.token) {
    return preferredTokenResult;
  }

  // Step 6: Create new payment link
  const paymentResult = await createOrderPaymentLink(
    merchantResult.merchant,
    {
      display_currency: order.display_currency,
      display_amount: order.display_amount,
      description: order.description,
      preferred_token_id: preferredTokenIdToUse,
    },
    order.number,
    order.required_amount_usd,
    destinationTokenResult.token,
    preferredTokenResult.token,
  );

  if (!paymentResult.success || !paymentResult.paymentDetail) {
    return paymentResult;
  }

  // Step 7: Update order
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CONSTANTS.ORDER.EXPIRY_MINUTES * 60 * 1000,
  );

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_id: paymentResult.paymentDetail.id,
      payment_data: paymentResult.paymentDetail,
      preferred_token_id: preferredTokenIdToUse,
      status: CONSTANTS.STATUS.PAYMENT.PENDING,
      expired_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("order_id", orderId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    paymentDetail: paymentResult.paymentDetail,
    expired_at: expiresAt.toISOString(),
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /orders - Get all orders for merchant
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse query parameters
  const url = new URL(c.req.url);
  const paginationResult = validatePaginationParams(
    url.searchParams.get("limit"),
    url.searchParams.get("offset"),
  );
  if (!paginationResult.success) {
    return c.json({ success: false, error: paginationResult.error }, 400);
  }

  const statusResult = validateStatusFilter(url.searchParams.get("status"));
  if (!statusResult.success) {
    return c.json({ success: false, error: statusResult.error }, 400);
  }

  const { limit, offset } = paginationResult;

  // Build query
  const applyStatusFilter = (query: any) => {
    if (!statusResult.status) return query;
    if (statusResult.status === "PENDING") {
      return query.in("status", ["PENDING", "PROCESSING"]);
    }
    return query.eq("status", statusResult.status);
  };

  // Execute queries in parallel
  const [countResult, ordersResult] = await Promise.all([
    applyStatusFilter(
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchantResult.merchant.merchant_id),
    ),
    applyStatusFilter(
      supabase
        .from("orders")
        .select("*")
        .eq("merchant_id", merchantResult.merchant.merchant_id),
    )
      .order("created_at", { ascending: false })
      .range(offset!, offset! + limit! - 1),
  ]);

  const { count: totalCount } = countResult;
  const { data: orders, error } = ordersResult;

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  return c.json({
    success: true,
    orders: orders || [],
    total: totalCount || 0,
    offset,
    limit,
  });
});

/**
 * GET /orders/:orderId - Get single order
 */
app.get("/:orderId", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");
  const orderId = c.req.param("orderId");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Get order
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("merchant_id", merchantResult.merchant.merchant_id)
    .single();

  if (error || !order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  const intentPayUrl = Deno.env.get("ROZO_PAY_URL");
  if (!intentPayUrl) {
    return c.json({ success: false, error: "ROZO_PAY_URL is not set" }, 500);
  }

  return c.json({
    success: true,
    order: {
      ...order,
      qrcode: `${intentPayUrl}${order.payment_id}`,
    },
  });
});

/**
 * POST /orders - Create new order
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Parse and validate request
  const body = await c.req.json();
  const validation = validateCreateOrderRequest(body);
  if (!validation.success || !validation.data) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Create order
  const result = await createOrder(
    supabase,
    userProviderId,
    isPrivyAuth,
    validation.data,
  );

  if (!result.success || !result.paymentDetail) {
    const status = result.code ? 403 : 400;
    return c.json(
      { success: false, error: result.error, code: result.code },
      status,
    );
  }

  const intentPayUrl = Deno.env.get("ROZO_PAY_URL");
  if (!intentPayUrl) {
    return c.json({ success: false, error: "ROZO_PAY_URL is not set" }, 500);
  }

  return c.json(
    {
      success: true,
      message: "Order created successfully",
      data: {
        payment_detail: result.paymentDetail,
        order_id: result.order_id,
        order_number: result.order_number,
        expired_at: result.expired_at,
        qrcode: `${intentPayUrl}${result.paymentDetail.id}`,
      },
    },
    201,
  );
});

/**
 * POST /orders/:orderId/regenerate-payment - Regenerate payment link
 */
app.post("/:orderId/regenerate-payment", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");
  const orderId = c.req.param("orderId");

  // Parse optional preferred_token_id
  let newPreferredTokenId: string | undefined;
  try {
    const body = await c.req.json();
    newPreferredTokenId = body.preferred_token_id;
  } catch {
    // Body is optional
  }

  // Regenerate payment
  const result = await regeneratePaymentLink(
    supabase,
    orderId,
    userProviderId,
    isPrivyAuth,
    newPreferredTokenId,
  );

  if (!result.success || !result.paymentDetail) {
    const status = result.code ? 403 : 400;
    return c.json(
      { success: false, error: result.error, code: result.code },
      status,
    );
  }

  const intentPayUrl = Deno.env.get("ROZO_PAY_URL");
  if (!intentPayUrl) {
    return c.json({ success: false, error: "ROZO_PAY_URL is not set" }, 500);
  }

  return c.json({
    success: true,
    qrcode: `${intentPayUrl}${result.paymentDetail.id}`,
    order_id: orderId,
    expired_at: result.expired_at,
    message: "Payment link regenerated successfully",
    paymentDetail: result.paymentDetail,
  });
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
