/**
 * Orders Function
 * Handles order creation, retrieval, and payment regeneration
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

// Middleware
import {
  errorMiddleware,
  getMerchantFromContext,
  merchantResolverMiddleware,
  notFoundHandler,
  privyAuthMiddleware,
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
  OrderStatusSchema,
  PaginationSchema,
  RegeneratePaymentSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { ApiResponse, PaginatedResponse } from "../../_shared/types/api.types.ts";
import type {
  CreateOrderData,
  Order,
  OrderData,
  RegeneratePaymentData,
} from "./types.ts";

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath("/orders");

// Global middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", privyAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /orders - Get all orders for merchant (paginated)
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse pagination params
  const url = new URL(c.req.url);
  const paginationResult = safeParseBody(PaginationSchema, {
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined,
  });

  if (!paginationResult.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: paginationResult.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const { limit, offset } = paginationResult.data;

  // Parse status filter
  const statusParam = url.searchParams.get("status");
  let statusFilter: string | null = null;

  if (statusParam) {
    const statusResult = safeParseBody(OrderStatusSchema, statusParam);
    if (!statusResult.success) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: statusResult.error,
        code: "VALIDATION_ERROR",
      }, 400);
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

  // Execute queries in parallel
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
    return c.json<ApiResponse<null>>({
      success: false,
      error: error.message,
      code: "DATABASE_ERROR",
    }, 400);
  }

  const total = totalCount || 0;

  return c.json<PaginatedResponse<Order>>({
    success: true,
    data: (orders || []) as Order[],
    pagination: {
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /orders/:orderId - Get single order
 */
app.get("/:orderId", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const orderId = c.req.param("orderId");

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("merchant_id", merchant.merchant_id)
    .single();

  if (error || !order) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Order not found",
      code: "NOT_FOUND",
    }, 404);
  }

  const qrcode = getPaymentQrCodeUrl(order.payment_id);

  return c.json<ApiResponse<OrderData>>({
    success: true,
    data: {
      ...order,
      qrcode,
    } as OrderData,
  });
});

/**
 * POST /orders - Create new order
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  const validation = safeParseBody(CreateOrderSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await createTransaction({
    supabase,
    merchant,
    input: validation.data,
    type: "order",
  });

  if (!result.success || !result.paymentDetail) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to create order",
      code: result.code || "ORDER_ERROR",
    }, result.code ? 403 : 400);
  }

  const qrcode = getPaymentQrCodeUrl(result.paymentDetail.id);

  return c.json<ApiResponse<CreateOrderData>>({
    success: true,
    data: {
      payment_detail: result.paymentDetail,
      order_id: result.record_id!,
      order_number: result.number || null,
      expired_at: result.expired_at!,
      qrcode,
    },
    message: "Order created successfully",
  }, 201);
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

  const result = await regenerateOrderPaymentLink({
    supabase,
    merchant,
    orderId,
    newPreferredTokenId,
  });

  if (!result.success || !result.paymentDetail) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to regenerate payment",
      code: result.code || "REGENERATE_ERROR",
    }, result.code ? 403 : 400);
  }

  const qrcode = getPaymentQrCodeUrl(result.paymentDetail.id);

  return c.json<ApiResponse<RegeneratePaymentData>>({
    success: true,
    data: {
      order_id: orderId,
      expired_at: result.expired_at!,
      qrcode,
      payment_detail: result.paymentDetail,
    },
    message: "Payment link regenerated successfully",
  });
});

// Not found handler
app.notFound(notFoundHandler);

// Export
Deno.serve(app.fetch);
