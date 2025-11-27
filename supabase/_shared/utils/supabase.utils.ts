/**
 * Supabase Utilities
 * Supabase client factory and helpers
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../database.types.ts";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Create a typed Supabase client
 */
export function createSupabaseClient(
  url?: string,
  key?: string,
): TypedSupabaseClient {
  const supabaseUrl = url || Deno.env.get("ROZO_SUPABASE_URL")!;
  const supabaseKey = key || Deno.env.get("ROZO_SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get environment variables for authentication
 */
export function getAuthEnvVars(): {
  privyAppId: string;
  privyAppSecret: string;
  supabaseUrl: string;
  supabaseKey: string;
  valid: boolean;
} {
  const privyAppId = Deno.env.get("PRIVY_APP_ID") || "";
  const privyAppSecret = Deno.env.get("PRIVY_APP_SECRET") || "";
  const supabaseUrl = Deno.env.get("ROZO_SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("ROZO_SUPABASE_SERVICE_ROLE_KEY") || "";

  const valid = !!(
    privyAppId &&
    privyAppSecret &&
    supabaseUrl &&
    supabaseKey
  );

  return {
    privyAppId,
    privyAppSecret,
    supabaseUrl,
    supabaseKey,
    valid,
  };
}

/**
 * Get payment-related environment variables
 */
export function getPaymentEnvVars(): {
  daimoApiKey: string;
  rozoPayUrl: string;
  valid: boolean;
} {
  const daimoApiKey = Deno.env.get("DAIMO_API_KEY") || "";
  const rozoPayUrl = Deno.env.get("ROZO_PAY_URL") || "";

  return {
    daimoApiKey,
    rozoPayUrl,
    valid: !!daimoApiKey && !!rozoPayUrl,
  };
}

/**
 * Get Privy wallet environment variables
 */
export function getPrivyWalletEnvVars(): {
  policyId: string;
  authorizationPrivateKey: string;
  valid: boolean;
} {
  const policyId = Deno.env.get("PRIVY_POLICY_ID") || "";
  const authorizationPrivateKey =
    Deno.env.get("PRIVY_AUTHORIZATION_PRIVATE_KEY") || "";

  return {
    policyId,
    authorizationPrivateKey,
    valid: !!policyId && !!authorizationPrivateKey,
  };
}
