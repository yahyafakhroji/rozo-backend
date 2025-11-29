/**
 * Deposits Function
 * Handles deposit creation and listing
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

// Middleware
import {
  dualAuthMiddleware,
  errorMiddleware,
  getMerchantFromContext,
  merchantResolverMiddleware,
  notFoundHandler,
} from "../../_shared/middleware/index.ts";

// Services
import { getPaymentQrCodeUrl } from "../../_shared/services/payment.service.ts";

// Factories
import { createTransaction } from "../../_shared/factories/transactionFactory.ts";

// Schemas
import {
  CreateDepositSchema,
  OrderStatusSchema,
  PaginationSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { ApiResponse, PaginatedResponse } from "../../_shared/types/api.types.ts";
import type {
  CreateDepositData,
  Deposit,
  DepositData,
} from "./types.ts";

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath("/deposits");

// Global middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /deposits - Get all deposits for merchant (paginated)
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
  const [countResult, depositsResult] = await Promise.all([
    applyStatusFilter(
      supabase
        .from("deposits")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchant.merchant_id),
    ),
    applyStatusFilter(
      supabase
        .from("deposits")
        .select("*")
        .eq("merchant_id", merchant.merchant_id),
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
  ]);

  const { count: totalCount } = countResult;
  const { data: deposits, error } = depositsResult;

  if (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: error.message,
      code: "DATABASE_ERROR",
    }, 400);
  }

  const total = totalCount || 0;

  return c.json<PaginatedResponse<Deposit>>({
    success: true,
    data: (deposits || []) as Deposit[],
    pagination: {
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /deposits/:depositId - Get single deposit
 */
app.get("/:depositId", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const depositId = c.req.param("depositId");

  const { data: deposit, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("deposit_id", depositId)
    .eq("merchant_id", merchant.merchant_id)
    .single();

  if (error || !deposit) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Deposit not found",
      code: "NOT_FOUND",
    }, 404);
  }

  const qrcode = getPaymentQrCodeUrl(deposit.payment_id);

  return c.json<ApiResponse<DepositData>>({
    success: true,
    data: {
      ...deposit,
      qrcode,
    } as DepositData,
  });
});

/**
 * POST /deposits - Create new deposit
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  const validation = safeParseBody(CreateDepositSchema, await c.req.json());
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
    type: "deposit",
  });

  if (!result.success || !result.paymentDetail) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to create deposit",
      code: result.code || "DEPOSIT_ERROR",
    }, result.code ? 403 : 400);
  }

  const qrcode = getPaymentQrCodeUrl(result.paymentDetail.id);

  return c.json<ApiResponse<CreateDepositData>>({
    success: true,
    data: {
      deposit_id: result.record_id!,
      qrcode,
    },
    message: "Deposit created successfully",
  }, 201);
});

// Not found handler
app.notFound(notFoundHandler);

// Export
Deno.serve(app.fetch);
