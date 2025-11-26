/**
 * Withdrawals Function
 * Handles withdrawal history and creation
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
} from "../../_shared/middleware/index.ts";

// Services
import { validateMerchant, requirePinValidation } from "../../_shared/services/merchant.service.ts";

// Validators
import { validateWithdrawalRequest } from "../../_shared/validators/order.validator.ts";

// Utils
import { extractPinFromHeaders } from "../../_shared/utils/helpers.ts";

const app = new Hono().basePath("/withdrawals");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /withdrawals - Get withdrawal history
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Retrieve withdrawal histories
  const { data: withdrawals, error } = await supabase
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
    .eq("merchant_id", merchantResult.merchant.merchant_id)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ success: false, error: "Failed to retrieve withdrawal histories" }, 500);
  }

  return c.json({
    success: true,
    data: withdrawals || [],
    count: withdrawals?.length || 0,
  });
});

/**
 * POST /withdrawals - Create withdrawal request
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse and validate request
  const body = await c.req.json();
  const validation = validateWithdrawalRequest(body);
  if (!validation.success || !validation.data) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const { recipient, amount, currency } = validation.data;

  // Check if merchant has PIN set and validate
  const { data: merchantWithPin } = await supabase
    .from("merchants")
    .select("pin_code_hash")
    .eq("merchant_id", merchantResult.merchant.merchant_id)
    .single();

  if (merchantWithPin?.pin_code_hash) {
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
      merchantId: merchantResult.merchant.merchant_id,
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
  const { data: withdrawal, error } = await supabase
    .from("withdrawals")
    .insert({
      merchant_id: merchantResult.merchant.merchant_id,
      recipient,
      amount,
      currency,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return c.json({ success: false, error: "Failed to create withdrawal request" }, 500);
  }

  return c.json({ success: true, data: withdrawal }, 201);
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
