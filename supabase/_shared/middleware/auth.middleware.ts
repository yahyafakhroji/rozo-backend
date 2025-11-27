/**
 * Authentication Middleware
 * Privy authentication middleware for Hono
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken, verifyPrivyJWT } from "../utils/jwt.utils.ts";
import { MerchantStatus } from "../config/constants.ts";

/**
 * Environment variables interface
 */
interface AuthEnvVars {
  privyAppId: string;
  privyAppSecret: string;
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Get authentication environment variables
 */
function getAuthEnvVars(): AuthEnvVars | null {
  const privyAppId = Deno.env.get("PRIVY_APP_ID");
  const privyAppSecret = Deno.env.get("PRIVY_APP_SECRET");
  const supabaseUrl = Deno.env.get("ROZO_SUPABASE_URL");
  const supabaseKey = Deno.env.get("ROZO_SUPABASE_SERVICE_ROLE_KEY");

  if (!privyAppId || !privyAppSecret || !supabaseUrl || !supabaseKey) {
    return null;
  }

  return {
    privyAppId,
    privyAppSecret,
    supabaseUrl,
    supabaseKey,
  };
}

/**
 * Privy authentication middleware for Hono
 * Sets the following context variables:
 * - supabase: Supabase client
 * - privyId: User's Privy ID
 * - walletAddress: User's wallet address
 * - token: Original JWT token
 */
export const privyAuthMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  // Get environment variables
  const envVars = getAuthEnvVars();
  if (!envVars) {
    return c.json({ error: "Missing environment variables" }, 500);
  }

  // Extract bearer token
  const authHeader = c.req.header("Authorization");
  const token = extractBearerToken(authHeader || null);

  if (!token) {
    return c.json(
      { error: "Missing or invalid authorization header" },
      401,
    );
  }

  // Verify with Privy
  const privy = await verifyPrivyJWT(
    token,
    envVars.privyAppId,
    envVars.privyAppSecret,
  );

  if (!privy.success) {
    return c.json(
      {
        error: "Invalid or expired token",
        details: privy.error,
      },
      401,
    );
  }

  const privyId = privy.payload?.id || null;
  const walletAddress = privy.embedded_wallet_address || null;

  if (!walletAddress || !privyId) {
    return c.json(
      {
        error: "Missing embedded wallet address or user id",
      },
      422,
    );
  }

  // Create Supabase client
  const supabase = createClient(envVars.supabaseUrl, envVars.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Set context variables
  c.set("supabase", supabase);
  c.set("privyId", privyId);
  c.set("walletAddress", walletAddress);
  c.set("token", token);

  await next();
};

/**
 * @deprecated Use privyAuthMiddleware instead
 * Alias for backward compatibility during migration
 */
export const dualAuthMiddleware = privyAuthMiddleware;

/**
 * Merchant status check middleware
 * Must be used after privyAuthMiddleware
 * Blocks requests from PIN_BLOCKED or INACTIVE merchants
 */
export const merchantStatusMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase");
  const privyId = c.get("privyId");

  if (!supabase || !privyId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Get merchant status
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("merchant_id, status")
    .eq("privy_id", privyId)
    .single();

  if (merchantError || !merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  // Check merchant status
  if (merchant.status === MerchantStatus.PIN_BLOCKED) {
    return c.json(
      {
        error: "Account blocked due to PIN security violations",
        code: "PIN_BLOCKED",
      },
      403,
    );
  }

  if (merchant.status === MerchantStatus.INACTIVE) {
    return c.json(
      {
        error: "Account is inactive",
        code: "INACTIVE",
      },
      403,
    );
  }

  // Set merchant ID in context
  c.set("merchantId", merchant.merchant_id);

  await next();
};

/**
 * Combined auth + merchant status middleware
 */
export const authWithStatusMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  // First run auth middleware
  let nextCalled = false;
  await privyAuthMiddleware(c, async () => {
    nextCalled = true;
  });

  if (!nextCalled) return; // Auth middleware returned early

  // Then run merchant status check
  await merchantStatusMiddleware(c, next);
};

// Type declarations for Hono context variables
declare module "jsr:@hono/hono" {
  interface ContextVariableMap {
    supabase: ReturnType<typeof createClient>;
    privyId: string;
    walletAddress: string;
    token: string;
    merchantId: string;
  }
}
