/**
 * Withdrawals Function
 * Handles withdrawal history and creation
 * Refactored to use new middleware and type-safe utilities
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
import { requirePinValidation } from "../../_shared/services/merchant.service.ts";
import {
  logWithdrawalEvent,
  AuditAction,
} from "../../_shared/services/audit.service.ts";

// Schemas
import {
  CreateWithdrawalSchema,
  PaginationSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Utils
import { extractPinFromHeaders } from "../../_shared/utils/helpers.ts";
import { rateLimitByMerchant, RATE_LIMITS } from "../../_shared/utils/rateLimit.utils.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/withdrawals");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /withdrawals - Get withdrawal history
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse pagination
  const url = new URL(c.req.url);
  const paginationResult = safeParseBody(PaginationSchema, {
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined,
  });

  if (!paginationResult.success) {
    return c.json({ success: false, error: paginationResult.error }, 400);
  }

  const { limit, offset } = paginationResult.data;

  // Run count and data queries in parallel
  const [countResult, withdrawalsResult] = await Promise.all([
    supabase
      .from("withdrawals")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", merchant.merchant_id),
    supabase
      .from("withdrawals")
      .select(`
        withdrawal_id,
        recipient,
        amount,
        currency,
        tx_hash,
        created_at,
        updated_at
      `)
      .eq("merchant_id", merchant.merchant_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
  ]);

  const { data: withdrawals, error } = withdrawalsResult;
  const { count: totalCount } = countResult;

  if (error) {
    return c.json({ success: false, error: "Failed to retrieve withdrawal histories" }, 500);
  }

  return c.json({
    success: true,
    data: withdrawals || [],
    total: totalCount || 0,
    offset,
    limit,
  });
});

/**
 * POST /withdrawals - Create withdrawal request
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Apply rate limiting for withdrawals
  try {
    rateLimitByMerchant(merchant.merchant_id, "withdrawals", RATE_LIMITS.WITHDRAWAL);
  } catch (error) {
    return c.json({
      success: false,
      error: "Too many withdrawal requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    }, 429);
  }

  // Parse and validate request
  const body = await c.req.json();
  const validation = safeParseBody(CreateWithdrawalSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const { recipient, amount, currency } = validation.data;

  // Check if merchant has PIN set and validate
  if (merchant.has_pin) {
    const pinCode = extractPinFromHeaders(c.req.raw);

    if (!pinCode) {
      return c.json({
        success: false,
        error: "PIN code is required for withdrawal operations",
        code: "PIN_REQUIRED",
      }, 400);
    }

    const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const userAgent = c.req.header("user-agent") || "unknown";

    const pinValidation = await requirePinValidation({
      supabase,
      merchantId: merchant.merchant_id,
      pinCode,
      ipAddress,
      userAgent,
    });

    if (!pinValidation.success) {
      return c.json({
        success: false,
        error: pinValidation.error,
        attempts_remaining: pinValidation.result?.attempts_remaining,
        is_blocked: pinValidation.result?.is_blocked,
      }, 401);
    }
  }

  // Insert withdrawal record
  const now = new Date().toISOString();
  const { data: withdrawal, error } = await supabase
    .from("withdrawals")
    .insert({
      merchant_id: merchant.merchant_id,
      recipient,
      amount,
      currency,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    return c.json({ success: false, error: "Failed to create withdrawal request" }, 500);
  }

  // Log audit event
  logWithdrawalEvent(
    supabase,
    merchant.merchant_id,
    withdrawal.withdrawal_id,
    AuditAction.WITHDRAWAL_INITIATED,
    { recipient, amount, currency },
  );

  return c.json({ success: true, data: withdrawal }, 201);
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
