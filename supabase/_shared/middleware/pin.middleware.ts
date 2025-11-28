/**
 * PIN Validation Middleware
 * PIN code validation middleware for sensitive operations
 *
 * IMPORTANT: Must be used AFTER merchantResolverMiddleware
 * Uses the already-resolved merchant from context to avoid duplicate queries
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { requirePinValidation } from "../services/merchant.service.ts";
import { extractClientInfo, extractPinFromHeaders } from "../utils/helpers.ts";
import type { ResolvedMerchant } from "./merchantResolver.middleware.ts";
import type { TypedSupabaseClient } from "../types/common.types.ts";

/**
 * PIN validation middleware for Hono
 * Validates PIN code for merchants that have PIN enabled
 *
 * Prerequisites:
 * - Must be used after privyAuthMiddleware
 * - Must be used after merchantResolverMiddleware
 *
 * Usage:
 * ```typescript
 * app.use("*", privyAuthMiddleware);
 * app.use("*", merchantResolverMiddleware);
 * app.post("/sensitive-action", pinValidationMiddleware, handler);
 * ```
 */
export const pinValidationMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = c.get("merchant") as ResolvedMerchant | undefined;

  if (!supabase) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  if (!merchant) {
    return c.json(
      {
        success: false,
        error: "Merchant not resolved. Ensure merchantResolverMiddleware is applied before pinValidationMiddleware.",
      },
      500,
    );
  }

  // Check if merchant has PIN set
  if (!merchant.has_pin) {
    // No PIN required, proceed
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

  // PIN validated, proceed
  await next();
};

/**
 * Optional PIN validation middleware
 * Validates PIN if provided, but doesn't require it
 *
 * Use case: Operations where PIN adds extra security but isn't mandatory
 *
 * Prerequisites:
 * - Must be used after privyAuthMiddleware
 * - Must be used after merchantResolverMiddleware
 */
export const optionalPinMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = c.get("merchant") as ResolvedMerchant | undefined;

  if (!supabase) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  if (!merchant) {
    return c.json(
      {
        success: false,
        error: "Merchant not resolved. Ensure merchantResolverMiddleware is applied before optionalPinMiddleware.",
      },
      500,
    );
  }

  // If no PIN is set, just proceed
  if (!merchant.has_pin) {
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
