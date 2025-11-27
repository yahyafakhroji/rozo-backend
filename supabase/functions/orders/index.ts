/**
 * Orders Function
 * Handles order creation, retrieval, and payment regeneration
 * Refactored to use new middleware, factories, and type-safe utilities
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
  merchantResolverMiddleware,
  getMerchantFromContext,
} from "../../_shared/middleware/index.ts";

// Services
import { getPaymentQrCodeUrl } from "../../_shared/services/payment.service.ts";

// Factories
import {
  createTransaction,
  regenerateOrderPaymentLink,
} from "../../_shared/factories/transactionFactory.ts";

// Schemas
import {
  CreateOrderSchema,
  RegeneratePaymentSchema,
  PaginationSchema,
  OrderStatusSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/orders");

// Apply middleware stack
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /orders - Get all orders for merchant
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse and validate query parameters
  const url = new URL(c.req.url);
  const paginationResult = safeParseBody(PaginationSchema, {
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined,
  });

  if (!paginationResult.success) {
    return c.json({ success: false, error: paginationResult.error }, 400);
  }

  const { limit, offset } = paginationResult.data;

  // Parse status filter
  const statusParam = url.searchParams.get("status");
  let statusFilter: string | null = null;

  if (statusParam) {
    const statusResult = safeParseBody(OrderStatusSchema, statusParam);
    if (!statusResult.success) {
      return c.json({ success: false, error: statusResult.error }, 400);
    }
    statusFilter = statusResult.data;
  }

  // Build query with status filter
  const applyStatusFilter = (query: ReturnType<typeof supabase.from>) => {
    if (!statusFilter) return query;
    if (statusFilter === "PENDING") {
      return query.in("status", ["PENDING", "PROCESSING"]);
    }
    return query.eq("status", statusFilter);
  };

  // Execute queries in parallel for better performance
  const [countResult, ordersResult] = await Promise.all([
    applyStatusFilter(
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchant.merchant_id),
    ),
    applyStatusFilter(
      supabase
        .from("orders")
        .select("*")
        .eq("merchant_id", merchant.merchant_id),
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
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
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const orderId = c.req.param("orderId");

  // Get order
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("merchant_id", merchant.merchant_id)
    .single();

  if (error || !order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  const qrcode = getPaymentQrCodeUrl(order.payment_id);

  return c.json({
    success: true,
    order: {
      ...order,
      qrcode,
    },
  });
});

/**
 * POST /orders - Create new order
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse and validate request body
  const body = await c.req.json();
  const validation = safeParseBody(CreateOrderSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Create order using factory
  const result = await createTransaction({
    supabase,
    merchant,
    input: validation.data,
    type: "order",
  });

  if (!result.success || !result.paymentDetail) {
    const status = result.code ? 403 : 400;
    return c.json(
      { success: false, error: result.error, code: result.code },
      status,
    );
  }

  const qrcode = getPaymentQrCodeUrl(result.paymentDetail.id);

  return c.json(
    {
      success: true,
      message: "Order created successfully",
      data: {
        payment_detail: result.paymentDetail,
        order_id: result.record_id,
        order_number: result.number,
        expired_at: result.expired_at,
        qrcode,
      },
    },
    201,
  );
});

/**
 * POST /orders/:orderId/regenerate-payment - Regenerate payment link
 */
app.post("/:orderId/regenerate-payment", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const orderId = c.req.param("orderId");

  // Parse optional request body
  let newPreferredTokenId: string | undefined;
  try {
    const body = await c.req.json();
    const validation = safeParseBody(RegeneratePaymentSchema, body);
    if (validation.success) {
      newPreferredTokenId = validation.data.preferred_token_id;
    }
  } catch {
    // Body is optional
  }

  // Regenerate payment using factory
  const result = await regenerateOrderPaymentLink({
    supabase,
    merchant,
    orderId,
    newPreferredTokenId,
  });

  if (!result.success || !result.paymentDetail) {
    const status = result.code ? 403 : 400;
    return c.json(
      { success: false, error: result.error, code: result.code },
      status,
    );
  }

  const qrcode = getPaymentQrCodeUrl(result.paymentDetail.id);

  return c.json({
    success: true,
    qrcode,
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
