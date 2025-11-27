/**
 * PIN Validation Middleware
 * PIN code validation middleware for sensitive operations
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { requirePinValidation } from "../services/merchant.service.ts";
import { extractClientInfo, extractPinFromHeaders } from "../utils/helpers.ts";

/**
 * PIN validation middleware for Hono
 * Validates PIN code for merchants that have PIN enabled
 * Must be used after privyAuthMiddleware
 */
export const pinValidationMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase");
  const privyId = c.get("privyId");

  if (!supabase || !privyId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Get merchant data including PIN hash
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("merchant_id, status, pin_code_hash")
    .eq("privy_id", privyId)
    .single();

  if (merchantError || !merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  // Check if merchant has PIN set
  if (!merchant.pin_code_hash) {
    // No PIN required, proceed
    c.set("merchantId", merchant.merchant_id);
    await next();
    return;
  }

  // Extract PIN from headers
  const pinCode = extractPinFromHeaders(c.req.raw);

  if (!pinCode) {
    return c.json(
      {
        success: false,
        error: "PIN code is required for this operation",
        code: "PIN_REQUIRED",
      },
      400,
    );
  }

  // Extract client info for logging
  const { ipAddress, userAgent } = extractClientInfo(c.req.raw);

  // Validate PIN code
  const pinValidation = await requirePinValidation({
    supabase,
    merchantId: merchant.merchant_id,
    pinCode,
    ipAddress,
    userAgent,
  });

  if (!pinValidation.success) {
    return c.json(
      {
        success: false,
        error: pinValidation.error,
        attempts_remaining: pinValidation.result?.attempts_remaining,
        is_blocked: pinValidation.result?.is_blocked,
      },
      401,
    );
  }

  // PIN validated, set merchant ID and proceed
  c.set("merchantId", merchant.merchant_id);
  await next();
};

/**
 * Optional PIN validation middleware
 * Only validates PIN if merchant has one set, doesn't block if no PIN
 */
export const optionalPinMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase");
  const privyId = c.get("privyId");

  if (!supabase || !privyId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Get merchant data
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("merchant_id, status, pin_code_hash")
    .eq("privy_id", privyId)
    .single();

  if (merchantError || !merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  c.set("merchantId", merchant.merchant_id);

  // If no PIN is set, just proceed
  if (!merchant.pin_code_hash) {
    await next();
    return;
  }

  // Try to get PIN from headers
  const pinCode = extractPinFromHeaders(c.req.raw);

  // If PIN is provided, validate it
  if (pinCode) {
    const { ipAddress, userAgent } = extractClientInfo(c.req.raw);

    const pinValidation = await requirePinValidation({
      supabase,
      merchantId: merchant.merchant_id,
      pinCode,
      ipAddress,
      userAgent,
    });

    if (!pinValidation.success) {
      return c.json(
        {
          success: false,
          error: pinValidation.error,
          attempts_remaining: pinValidation.result?.attempts_remaining,
          is_blocked: pinValidation.result?.is_blocked,
        },
        401,
      );
    }
  }

  await next();
};

/**
 * Helper to check if PIN is required for a merchant
 */
export async function checkMerchantPinRequired(
  supabase: unknown,
  merchantId: string,
): Promise<boolean> {
  const { data: merchant, error } = await (supabase as any)
    .from("merchants")
    .select("pin_code_hash")
    .eq("merchant_id", merchantId)
    .single();

  if (error || !merchant) {
    return false;
  }

  return !!merchant.pin_code_hash;
}
