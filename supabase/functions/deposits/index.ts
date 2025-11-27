/**
 * Deposits Function
 * Handles deposit creation and listing
 * Refactored to use new middleware, factories, and type-safe utilities
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

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
import { createTransaction } from "../../_shared/factories/transactionFactory.ts";

// Schemas
import {
  CreateDepositSchema,
  PaginationSchema,
  OrderStatusSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/deposits");

// Apply middleware stack
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /deposits - Get all deposits for merchant
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
    return c.json({ success: false, error: error.message }, 400);
  }

  return c.json({
    success: true,
    deposits: deposits || [],
    total: totalCount || 0,
    offset,
    limit,
  });
});

/**
 * GET /deposits/:depositId - Get single deposit
 */
app.get("/:depositId", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const depositId = c.req.param("depositId");

  // Get deposit
  const { data: deposit, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("deposit_id", depositId)
    .eq("merchant_id", merchant.merchant_id)
    .single();

  if (error || !deposit) {
    return c.json({ success: false, error: "Deposit not found" }, 404);
  }

  const qrcode = getPaymentQrCodeUrl(deposit.payment_id);

  return c.json({
    success: true,
    deposit: {
      ...deposit,
      qrcode,
    },
  });
});

/**
 * POST /deposits - Create new deposit
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse and validate request body
  const body = await c.req.json();
  const validation = safeParseBody(CreateDepositSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Create deposit using factory
  const result = await createTransaction({
    supabase,
    merchant,
    input: validation.data,
    type: "deposit",
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
      qrcode,
      deposit_id: result.record_id,
      message: "Deposit created successfully",
    },
    201,
  );
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
