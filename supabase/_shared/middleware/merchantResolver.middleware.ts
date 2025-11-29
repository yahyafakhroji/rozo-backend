/**
 * Merchant Resolver Middleware
 * Caches merchant data in Hono context to eliminate duplicate queries
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { MerchantStatus } from "../config/constants.ts";
import type { MerchantData, TypedSupabaseClient } from "../types/common.types.ts";

/**
 * Full merchant data with all fields needed for operations
 */
export interface ResolvedMerchant extends MerchantData {
  has_pin: boolean;
}

/**
 * Merchant resolver middleware
 * Fetches and caches complete merchant data in context after auth
 * Must be used after privyAuthMiddleware
 *
 * Sets the following context variables:
 * - merchant: Full merchant data object
 * - merchantId: Merchant ID (convenience accessor)
 */
export const merchantResolverMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const privyId = c.get("privyId") as string;

  if (!supabase || !privyId) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  // Query merchant with all necessary fields
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select(`
      merchant_id,
      privy_id,
      email,
      display_name,
      description,
      logo_url,
      wallet_address,
      stellar_address,
      default_currency,
      default_token_id,
      default_language,
      status,
      pin_code_hash,
      pin_code_attempts,
      pin_code_blocked_at,
      pin_code_last_attempt_at,
      created_at,
      updated_at
    `)
    .eq("privy_id", privyId)
    .single();

  if (merchantError || !merchant) {
    return c.json({ success: false, error: "Merchant not found" }, 404);
  }

  // Check merchant status
  if (merchant.status === MerchantStatus.PIN_BLOCKED) {
    return c.json(
      {
        success: false,
        error: "Account blocked due to PIN security violations",
        code: "PIN_BLOCKED",
      },
      403,
    );
  }

  if (merchant.status === MerchantStatus.INACTIVE) {
    return c.json(
      {
        success: false,
        error: "Account is inactive",
        code: "INACTIVE",
      },
      403,
    );
  }

  // Create resolved merchant with computed fields
  const resolvedMerchant: ResolvedMerchant = {
    ...(merchant as MerchantData),
    has_pin: !!merchant.pin_code_hash,
  };

  // Cache in context
  c.set("merchant", resolvedMerchant);
  c.set("merchantId", merchant.merchant_id);

  await next();
};

/**
 * Combined auth + merchant resolver middleware
 * Convenience middleware that combines Privy auth and merchant resolution
 */
export const authWithMerchantMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  // Import here to avoid circular dependency
  const { privyAuthMiddleware } = await import("./auth.middleware.ts");

  // First run auth middleware
  let authNextCalled = false;
  await privyAuthMiddleware(c, async () => {
    authNextCalled = true;
  });

  if (!authNextCalled) return; // Auth middleware returned early

  // Then run merchant resolver
  await merchantResolverMiddleware(c, next);
};

/**
 * Get merchant from context (type-safe helper)
 * Throws if merchant is not resolved
 */
export function getMerchantFromContext(c: Context): ResolvedMerchant {
  const merchant = c.get("merchant") as ResolvedMerchant | undefined;
  if (!merchant) {
    throw new Error("Merchant not resolved. Ensure merchantResolverMiddleware is applied.");
  }
  return merchant;
}

/**
 * Get merchant ID from context (type-safe helper)
 */
export function getMerchantIdFromContext(c: Context): string {
  const merchantId = c.get("merchantId") as string | undefined;
  if (!merchantId) {
    throw new Error("Merchant ID not available. Ensure merchantResolverMiddleware is applied.");
  }
  return merchantId;
}

// Extend Hono context types
declare module "jsr:@hono/hono" {
  interface ContextVariableMap {
    merchant: ResolvedMerchant;
    merchantId: string;
  }
}
