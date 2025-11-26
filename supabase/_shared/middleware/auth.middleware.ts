/**
 * Authentication Middleware
 * Dual authentication middleware for Hono (Privy + Dynamic)
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken, verifyDynamicJWT, verifyPrivyJWT } from "../utils/jwt.utils.ts";
import { MerchantStatus } from "../config/constants.ts";

/**
 * Environment variables interface
 */
interface AuthEnvVars {
  dynamicEnvId: string;
  privyAppId: string;
  privyAppSecret: string;
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Get authentication environment variables
 */
function getAuthEnvVars(): AuthEnvVars | null {
  const dynamicEnvId = Deno.env.get("DYNAMIC_ENV_ID");
  const privyAppId = Deno.env.get("PRIVY_APP_ID");
  const privyAppSecret = Deno.env.get("PRIVY_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!dynamicEnvId || !privyAppId || !privyAppSecret || !supabaseUrl || !supabaseKey) {
    return null;
  }

  return {
    dynamicEnvId,
    privyAppId,
    privyAppSecret,
    supabaseUrl,
    supabaseKey,
  };
}

/**
 * Dual authentication middleware for Hono
 * Supports both Privy and Dynamic authentication
 * Sets the following context variables:
 * - supabase: Supabase client
 * - dynamicId: User provider ID (from Dynamic or Privy)
 * - walletAddress: User's wallet address
 * - isPrivyAuth: Boolean indicating if auth is via Privy
 * - token: Original JWT token
 */
export const dualAuthMiddleware: MiddlewareHandler = async (
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

  // Verify with Dynamic
  const tokenVerification = await verifyDynamicJWT(token, envVars.dynamicEnvId);

  // Both failed
  if (!tokenVerification.success && !privy.success) {
    return c.json(
      {
        error: "Invalid or expired token",
        details: tokenVerification.error || privy.error,
      },
      401,
    );
  }

  // Determine user provider ID and wallet address
  let userProviderId: string | null = null;
  let userProviderWalletAddress: string | null = null;
  let isPrivyAuth = false;

  if (tokenVerification.success) {
    userProviderId = tokenVerification.payload?.sub || null;
    userProviderWalletAddress = tokenVerification.embedded_wallet_address || null;
  }

  // Privy takes precedence
  if (privy.success) {
    userProviderId = privy.payload?.id || null;
    userProviderWalletAddress = privy.embedded_wallet_address || null;
    isPrivyAuth = true;
  }

  if (!userProviderWalletAddress || !userProviderId) {
    return c.json(
      {
        error: "Missing embedded wallet address or user provider id",
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
  c.set("dynamicId", userProviderId);
  c.set("walletAddress", userProviderWalletAddress);
  c.set("isPrivyAuth", isPrivyAuth);
  c.set("token", token);

  await next();
};

/**
 * Merchant status check middleware
 * Must be used after dualAuthMiddleware
 * Blocks requests from PIN_BLOCKED or INACTIVE merchants
 */
export const merchantStatusMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  if (!supabase || !userProviderId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Get merchant status
  const merchantQuery = supabase
    .from("merchants")
    .select("merchant_id, status");

  const { data: merchant, error: merchantError } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

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
  await dualAuthMiddleware(c, async () => {
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
    dynamicId: string;
    walletAddress: string;
    isPrivyAuth: boolean;
    token: string;
    merchantId: string;
  }
}
