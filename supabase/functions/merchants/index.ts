/**
 * Merchants Function
 * Handles merchant profile management and PIN operations
 * Refactored to use new middleware and type-safe utilities
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, CONSTANTS } from "../../_shared/config/index.ts";

// Middleware
import {
  privyAuthMiddleware,
  errorMiddleware,
  notFoundHandler,
  merchantResolverMiddleware,
  getMerchantFromContext,
} from "../../_shared/middleware/index.ts";

// Services
import {
  setMerchantPin,
  updateMerchantPin,
  revokeMerchantPin,
  validatePinCode,
} from "../../_shared/services/merchant.service.ts";
import {
  logPinOperation,
  AuditAction,
} from "../../_shared/services/audit.service.ts";

// Schemas
import {
  SetPinSchema,
  UpdatePinSchema,
  RevokePinSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

const DEFAULT_TOKEN_ID = CONSTANTS.DEFAULTS.TOKEN_ID;

const app = new Hono().basePath("/merchants");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /merchants - Get merchant profile
 */
app.get("/", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const merchant = getMerchantFromContext(c);

  // Create safe profile object by excluding PIN-related fields
  const {
    pin_code_hash,
    pin_code_attempts,
    pin_code_blocked_at,
    pin_code_last_attempt_at,
    ...safeProfile
  } = merchant as Record<string, unknown>;

  // Add computed has_pin field for convenience
  (safeProfile as Record<string, unknown>).has_pin = merchant.has_pin;

  return c.json({ success: true, profile: safeProfile });
});

/**
 * POST /merchants - Create or update merchant (upsert)
 */
app.post("/", privyAuthMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const privyId = c.get("privyId") as string;
  const walletAddress = c.get("walletAddress") as string;

  const body = await c.req.json().catch(() => ({}));

  // Email is required from request body
  const email = body.email;

  if (!email) {
    return c.json({ success: false, error: "Email is required" }, 400);
  }

  // Prepare merchant data
  const merchantData: Record<string, unknown> = {
    email,
    display_name: body.display_name || email,
    default_token_id: DEFAULT_TOKEN_ID,
    wallet_address: walletAddress,
    privy_id: privyId,
    updated_at: new Date().toISOString(),
  };

  if (body.description) {
    merchantData.description = body.description;
  }
  if (body.logo_url) {
    merchantData.logo_url = body.logo_url;
  }
  if (body.default_currency) {
    merchantData.default_currency = body.default_currency;
  }
  if (body.default_language) {
    merchantData.default_language = body.default_language;
  }

  // Check if merchant exists by email or Privy ID
  const { data: existingByEmail } = await supabase
    .from("merchants")
    .select("merchant_id, privy_id")
    .eq("email", email)
    .single();

  const { data: existingByPrivyId } = await supabase
    .from("merchants")
    .select("merchant_id, privy_id")
    .eq("privy_id", privyId)
    .single();

  let data, error;

  if (existingByEmail && !existingByPrivyId) {
    // Update existing merchant with new Privy ID
    ({ data, error } = await supabase
      .from("merchants")
      .update(merchantData)
      .eq("email", email)
      .select()
      .single());
  } else if (existingByPrivyId) {
    // Update existing merchant by Privy ID
    ({ data, error } = await supabase
      .from("merchants")
      .update(merchantData)
      .eq("privy_id", privyId)
      .select()
      .single());
  } else {
    // Insert new merchant
    ({ data, error } = await supabase
      .from("merchants")
      .insert(merchantData)
      .select()
      .single());
  }

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  return c.json({
    success: true,
    profile: data,
    message: "Merchant Created/Updated successfully",
  });
});

/**
 * PUT /merchants - Update merchant profile
 */
app.put("/", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse the request body
  const body = await c.req.json();
  const { display_name, logo, email, default_token_id, stellar_address } = body;

  // Prepare update data
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (email) updateData.email = email;
  if (display_name) updateData.display_name = display_name;
  if (default_token_id) updateData.default_token_id = default_token_id;
  if (stellar_address) updateData.stellar_address = stellar_address;

  // Handle logo upload if provided
  if (logo) {
    try {
      const base64Data = logo.split(",")[1];
      const binaryData = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));

      const bucketName = Deno.env.get("STORAGE_BUCKET_NAME")!;
      const fileName = `${merchant.merchant_id}_${Date.now()}.png`;
      const filePath = `merchants/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        return c.json({ success: false, error: `Storage upload failed: ${uploadError.message}` }, 400);
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      updateData.logo_url = publicUrlData.publicUrl;
    } catch (uploadError) {
      return c.json({
        success: false,
        error: uploadError instanceof Error ? uploadError.message : "Upload failed",
      }, 400);
    }
  }

  // Update merchant record
  const { data: updatedMerchant, error: updateError } = await supabase
    .from("merchants")
    .update(updateData)
    .eq("merchant_id", merchant.merchant_id)
    .select()
    .single();

  if (updateError) {
    return c.json({ success: false, error: updateError.message }, 400);
  }

  return c.json({
    success: true,
    profile: updatedMerchant,
    message: "Merchant updated successfully",
  });
});

// ============================================================================
// PIN Management Routes
// ============================================================================

/**
 * GET /merchants/status - Check merchant status
 */
app.get("/status", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const merchant = getMerchantFromContext(c);

  return c.json({
    success: true,
    status: merchant.status || "ACTIVE",
    has_pin: merchant.has_pin,
    pin_attempts: (merchant as Record<string, unknown>).pin_code_attempts || 0,
    pin_blocked_at: (merchant as Record<string, unknown>).pin_code_blocked_at,
  });
});

/**
 * POST /merchants/pin - Set PIN code
 */
app.post("/pin", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Validate request body
  const body = await c.req.json();
  const validation = safeParseBody(SetPinSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Extract client info
  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await setMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  // Log audit event
  if (result.success) {
    logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_SET, ipAddress, userAgent);
  }

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * PUT /merchants/pin - Update PIN code
 */
app.put("/pin", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Validate request body
  const body = await c.req.json();
  const validation = safeParseBody(UpdatePinSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await updateMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.current_pin,
    validation.data.new_pin,
    ipAddress,
    userAgent,
  );

  // Log audit event
  if (result.success) {
    logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_UPDATED, ipAddress, userAgent);
  }

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * DELETE /merchants/pin - Revoke PIN code
 */
app.delete("/pin", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Validate request body
  const body = await c.req.json();
  const validation = safeParseBody(RevokePinSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await revokeMerchantPin(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  // Log audit event
  if (result.success) {
    logPinOperation(supabase, merchant.merchant_id, AuditAction.PIN_REVOKED, ipAddress, userAgent);
  }

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * POST /merchants/pin/validate - Validate PIN code
 */
app.post("/pin/validate", privyAuthMiddleware, merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Validate request body
  const body = await c.req.json();
  const validation = safeParseBody(SetPinSchema, body); // Uses same schema

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await validatePinCode(
    supabase,
    merchant.merchant_id,
    validation.data.pin_code,
    ipAddress,
    userAgent,
  );

  return c.json(
    {
      success: result.success,
      attempts_remaining: result.attempts_remaining,
      is_blocked: result.is_blocked,
      message: result.message,
    },
    result.success ? 200 : 401,
  );
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
