/**
 * Profile Function
 * Handles merchant profile management and PIN operations
 */

import { Hono, type Context } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { CONSTANTS, corsConfig } from "../../_shared/config/index.ts";

// Middleware
import {
  errorMiddleware,
  getMerchantFromContext,
  merchantResolverMiddleware,
  notFoundHandler,
  privyAuthMiddleware,
} from "../../_shared/middleware/index.ts";

// Services
import {
  revokeMerchantPin,
  setMerchantPin,
  updateMerchantPin,
  validatePinCode,
} from "../../_shared/services/merchant.service.ts";
import {
  AuditAction,
  logPinOperation,
} from "../../_shared/services/audit.service.ts";

// Schemas
import {
  RevokePinSchema,
  safeParseBody,
  SetPinSchema,
  UpdatePinSchema,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { ApiResponse } from "../../_shared/types/api.types.ts";
import type {
  ClientInfo,
  PinValidationData,
  PrimaryWallet,
  ProfileData,
  ProfileStatusData,
  ResolvedMerchant,
  UploadResult,
} from "./types.ts";

// Utilities
import { createWallet } from "../../_shared/utils/privy.utils.ts";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TOKEN_ID = CONSTANTS.DEFAULTS.TOKEN_ID;
const DEFAULT_CHAIN_ID = "8453"; // Base chain

// ============================================================================
// Helper Functions
// ============================================================================

/** Extract client info from request headers */
function getClientInfo(c: Context): ClientInfo {
  return {
    ipAddress: c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ?? "unknown",
    userAgent: c.req.header("user-agent") ?? "unknown",
  };
}

/** Get primary wallet for merchant */
async function getPrimaryWallet(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<PrimaryWallet | null> {
  const { data } = await supabase
    .from("wallets")
    .select("wallet_id, address, chain_id, label, source")
    .eq("merchant_id", merchantId)
    .eq("is_primary", true)
    .single();

  return data;
}

/** Build profile data with primary wallet (excludes sensitive PIN fields) */
async function buildProfileData(
  supabase: TypedSupabaseClient,
  merchant: ResolvedMerchant,
): Promise<ProfileData> {
  const primaryWallet = await getPrimaryWallet(supabase, merchant.merchant_id);

  return {
    merchant_id: merchant.merchant_id,
    privy_id: merchant.privy_id,
    email: merchant.email,
    display_name: merchant.display_name,
    logo_url: merchant.logo_url,
    description: merchant.description,
    default_token_id: merchant.default_token_id,
    default_currency: merchant.default_currency,
    default_language: merchant.default_language,
    status: merchant.status,
    has_pin: merchant.has_pin,
    created_at: merchant.created_at,
    updated_at: merchant.updated_at,
    primary_wallet: primaryWallet,
  };
}

/** Ensure merchant has an EVM wallet, create if missing */
async function ensureEvmWallet(
  supabase: TypedSupabaseClient,
  merchantId: string,
  privyId: string,
): Promise<PrimaryWallet | null> {
  const { data: existingWallets } = await supabase
    .from("wallets")
    .select("wallet_id, chain_id, address, label, source")
    .eq("merchant_id", merchantId);

  const existing = existingWallets?.find((w) => w.chain_id === DEFAULT_CHAIN_ID);
  if (existing) {
    return existing;
  }

  const walletResult = await createWallet({
    chainType: "ethereum",
    ownerUserId: privyId,
  });

  if (!walletResult.success || !walletResult.wallet) {
    return null;
  }

  const { data: inserted, error } = await supabase
    .from("wallets")
    .insert({
      merchant_id: merchantId,
      chain_id: DEFAULT_CHAIN_ID,
      address: walletResult.wallet.address,
      label: "Primary Wallet",
      source: "privy",
      is_primary: true,
      is_verified: true,
      external_wallet_id: walletResult.wallet.id,
    })
    .select("wallet_id, address, chain_id, label, source")
    .single();

  if (error || !inserted) return null;

  return inserted;
}

/** Upload logo to storage */
async function uploadLogo(
  supabase: TypedSupabaseClient,
  merchantId: string,
  logo: string,
): Promise<UploadResult> {
  try {
    const base64Data = logo.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const bucketName = Deno.env.get("STORAGE_BUCKET_NAME")!;
    const filePath = `merchants/${merchantId}_${Date.now()}.png`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, binaryData, { contentType: "image/png", upsert: true });

    if (error) return { error: `Upload failed: ${error.message}` };

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { url: data.publicUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
}

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath("/profile");

// Global middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", privyAuthMiddleware);

// ============================================================================
// Profile Routes
// ============================================================================

/**
 * GET /profile - Get merchant profile with primary wallet
 */
app.get("/", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c) as ResolvedMerchant;

  const data = await buildProfileData(supabase, merchant);

  return c.json<ApiResponse<ProfileData>>({ success: true, data });
});

/**
 * POST /profile - Create or update merchant (upsert)
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const privyId = c.get("privyId") as string;
  const body = await c.req.json().catch(() => ({}));

  if (!body.email) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Email is required",
      code: "VALIDATION_ERROR",
    }, 400);
  }

  // Check existing merchant (parallel queries)
  const [{ data: byEmail }, { data: byPrivyId }] = await Promise.all([
    supabase.from("merchants").select("merchant_id, privy_id").eq("email", body.email).single(),
    supabase.from("merchants").select("merchant_id, privy_id").eq("privy_id", privyId).single(),
  ]);

  const isNewMerchant = !byEmail && !byPrivyId;

  // Build merchant data
  const merchantData = {
    email: body.email,
    display_name: body.display_name || body.email,
    default_token_id: DEFAULT_TOKEN_ID,
    privy_id: privyId,
    updated_at: new Date().toISOString(),
    ...(body.description && { description: body.description }),
    ...(body.logo_url && { logo_url: body.logo_url }),
    ...(body.default_currency && { default_currency: body.default_currency }),
    ...(body.default_language && { default_language: body.default_language }),
  };

  // Upsert merchant
  let result;
  if (byEmail && !byPrivyId) {
    result = await supabase.from("merchants").update(merchantData).eq("email", body.email).select().single();
  } else if (byPrivyId) {
    result = await supabase.from("merchants").update(merchantData).eq("privy_id", privyId).select().single();
  } else {
    result = await supabase.from("merchants").insert(merchantData).select().single();
  }

  if (result.error || !result.data) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error?.message || "Failed to save merchant",
      code: "DATABASE_ERROR",
    }, 400);
  }

  // Ensure wallet exists
  const primaryWallet = await ensureEvmWallet(supabase, result.data.merchant_id, privyId);

  const data: ProfileData = {
    merchant_id: result.data.merchant_id,
    privy_id: result.data.privy_id,
    email: result.data.email,
    display_name: result.data.display_name,
    logo_url: result.data.logo_url,
    description: result.data.description,
    default_token_id: result.data.default_token_id,
    default_currency: result.data.default_currency,
    default_language: result.data.default_language,
    status: result.data.status,
    has_pin: !!result.data.pin_code_hash,
    created_at: result.data.created_at,
    updated_at: result.data.updated_at,
    primary_wallet: primaryWallet,
  };

  return c.json<ApiResponse<ProfileData>>({
    success: true,
    data,
    message: isNewMerchant ? "Merchant created successfully" : "Merchant updated successfully",
  }, isNewMerchant ? 201 : 200);
});

/**
 * PUT /profile - Update merchant profile
 */
app.put("/", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c) as ResolvedMerchant;
  const body = await c.req.json();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...(body.email && { email: body.email }),
    ...(body.display_name && { display_name: body.display_name }),
    ...(body.default_token_id && { default_token_id: body.default_token_id }),
  };

  // Handle logo upload
  if (body.logo) {
    const logoResult = await uploadLogo(supabase, merchant.merchant_id, body.logo);
    if (logoResult.error) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: logoResult.error,
        code: "UPLOAD_ERROR",
      }, 400);
    }
    updateData.logo_url = logoResult.url;
  }

  const { data: updated, error } = await supabase
    .from("merchants")
    .update(updateData)
    .eq("merchant_id", merchant.merchant_id)
    .select()
    .single();

  if (error || !updated) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: error?.message || "Failed to update merchant",
      code: "DATABASE_ERROR",
    }, 400);
  }

  const data = await buildProfileData(supabase, {
    ...updated,
    has_pin: !!updated.pin_code_hash,
  } as ResolvedMerchant);

  return c.json<ApiResponse<ProfileData>>({ success: true, data });
});

// ============================================================================
// Status Route
// ============================================================================

/**
 * GET /profile/status - Check merchant status and PIN info
 */
app.get("/status", merchantResolverMiddleware, (c) => {
  const merchant = getMerchantFromContext(c) as ResolvedMerchant;

  const data: ProfileStatusData = {
    status: merchant.status || "ACTIVE",
    has_pin: merchant.has_pin,
    pin_attempts: merchant.pin_code_attempts || 0,
    pin_blocked_at: merchant.pin_code_blocked_at || null,
  };

  return c.json<ApiResponse<ProfileStatusData>>({ success: true, data });
});

// ============================================================================
// PIN Management Routes
// ============================================================================

/**
 * POST /profile/pin - Set initial PIN code
 */
app.post("/pin", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c) as ResolvedMerchant;
  const { ipAddress, userAgent } = getClientInfo(c);

  const validation = safeParseBody(SetPinSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await setMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to set PIN",
      code: "PIN_ERROR",
    }, 400);
  }

  logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_SET, ipAddress, userAgent);

  return c.json<ApiResponse<null>>({ success: true, message: result.message });
});

/**
 * PUT /profile/pin - Update existing PIN code
 */
app.put("/pin", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c) as ResolvedMerchant;
  const { ipAddress, userAgent } = getClientInfo(c);

  const validation = safeParseBody(UpdatePinSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await updateMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.current_pin,
    validation.data.new_pin,
    ipAddress,
    userAgent,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to update PIN",
      code: "PIN_ERROR",
    }, 400);
  }

  logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_UPDATED, ipAddress, userAgent);

  return c.json<ApiResponse<null>>({ success: true, message: result.message });
});

/**
 * DELETE /profile/pin - Revoke PIN code
 */
app.delete("/pin", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const { ipAddress, userAgent } = getClientInfo(c);

  const validation = safeParseBody(RevokePinSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await revokeMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to revoke PIN",
      code: "PIN_ERROR",
    }, 400);
  }

  logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_REVOKED, ipAddress, userAgent);

  return c.json<ApiResponse<null>>({ success: true, message: result.message });
});

/**
 * POST /profile/pin/validate - Validate PIN code
 */
app.post("/pin/validate", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const { ipAddress, userAgent } = getClientInfo(c);

  const validation = safeParseBody(SetPinSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await validatePinCode(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  const data: PinValidationData = {
    attempts_remaining: result.attempts_remaining ?? 0,
    is_blocked: result.is_blocked ?? false,
  };

  if (!result.success) {
    return c.json<ApiResponse<PinValidationData>>({
      success: false,
      error: result.message || "Invalid PIN",
      code: result.is_blocked ? "PIN_BLOCKED" : "PIN_INVALID",
      data,
    }, 401);
  }

  return c.json<ApiResponse<PinValidationData>>({ success: true, data });
});

// Not found handler
app.notFound(notFoundHandler);

// Export
Deno.serve(app.fetch);
