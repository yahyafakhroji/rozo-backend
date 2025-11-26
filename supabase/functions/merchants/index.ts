/**
 * Merchants Function
 * Handles merchant profile management and PIN operations
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
import {
  validateMerchant,
  setMerchantPin,
  updateMerchantPin,
  revokeMerchantPin,
  validatePinCode,
} from "../../_shared/services/merchant.service.ts";

const DEFAULT_TOKEN_ID = "USDC_BASE";

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
app.get("/", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Query merchant
  const merchantQuery = supabase.from("merchants").select("*");
  const { data, error } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

  if (!data) {
    return c.json({ success: false, error: "Data not found" }, 404);
  }

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  // Create safe profile object by excluding PIN-related fields
  const {
    pin_code_hash,
    pin_code_attempts,
    pin_code_blocked_at,
    pin_code_last_attempt_at,
    ...safeProfile
  } = data;

  // Add computed has_pin field for convenience
  safeProfile.has_pin = !!data.pin_code_hash;

  return c.json({ success: true, profile: safeProfile });
});

/**
 * POST /merchants - Create or update merchant (upsert)
 */
app.post("/", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const dynamicPayload = c.get("dynamicPayload");
  const privyPayload = c.get("privyPayload");
  const walletAddress = c.get("walletAddress");
  const isPrivyAuth = c.get("isPrivyAuth");

  const body = await c.req.json().catch(() => ({}));

  // Get email from token or request body
  const email = body.email ?? dynamicPayload?.email ?? privyPayload?.email?.address;

  if (!email) {
    return c.json({ success: false, error: "Email is required" }, 400);
  }

  // Prepare merchant data
  const merchantData: Record<string, unknown> = {
    email,
    display_name: body.display_name || email,
    default_token_id: DEFAULT_TOKEN_ID,
    wallet_address: walletAddress,
    updated_at: new Date().toISOString(),
  };

  if (dynamicPayload?.sub) {
    merchantData.dynamic_id = dynamicPayload.sub;
  }
  if (privyPayload?.id) {
    merchantData.privy_id = privyPayload.id;
  }
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

  // Check if merchant exists by email or provider
  const userProviderId = merchantData.dynamic_id || merchantData.privy_id;

  const { data: existingByEmail } = await supabase
    .from("merchants")
    .select("merchant_id, privy_id, dynamic_id")
    .eq("email", email)
    .single();

  const existingByProviderQuery = supabase
    .from("merchants")
    .select("merchant_id, privy_id, dynamic_id");

  const { data: existingByProvider } = isPrivyAuth
    ? await existingByProviderQuery.eq("privy_id", userProviderId).single()
    : await existingByProviderQuery.eq("dynamic_id", userProviderId).single();

  let data, error;

  if (existingByEmail && !existingByProvider) {
    // Update existing merchant with new provider info
    ({ data, error } = await supabase
      .from("merchants")
      .update(merchantData)
      .eq("email", email)
      .select()
      .single());
  } else if (existingByProvider) {
    // Update existing merchant by provider
    const updateQuery = supabase
      .from("merchants")
      .update(merchantData)
      .select()
      .single();

    ({ data, error } = isPrivyAuth
      ? await updateQuery.eq("privy_id", userProviderId)
      : await updateQuery.eq("dynamic_id", userProviderId));
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
app.put("/", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Get the current merchant data first
  const merchantQuery = supabase.from("merchants").select("*");
  const { data: existingMerchant, error: fetchError } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

  if (fetchError || !existingMerchant) {
    return c.json({ success: false, error: "Merchant not found" }, 404);
  }

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
      const fileName = `${existingMerchant.merchant_id}_${Date.now()}.png`;
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
  const updateQuery = supabase
    .from("merchants")
    .update(updateData)
    .select()
    .single();

  const { data: updatedMerchant, error: updateError } = isPrivyAuth
    ? await updateQuery.eq("privy_id", userProviderId)
    : await updateQuery.eq("dynamic_id", userProviderId);

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
app.get("/status", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  const merchantQuery = supabase
    .from("merchants")
    .select("merchant_id, status, pin_code_hash, pin_code_attempts, pin_code_blocked_at");

  const { data: merchant, error } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

  if (error || !merchant) {
    return c.json({ success: false, error: "Merchant not found" }, 404);
  }

  return c.json({
    success: true,
    status: merchant.status || "ACTIVE",
    has_pin: !!merchant.pin_code_hash,
    pin_attempts: merchant.pin_code_attempts || 0,
    pin_blocked_at: merchant.pin_code_blocked_at,
  });
});

/**
 * POST /merchants/pin - Set PIN code
 */
app.post("/pin", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant and check status
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  const body = await c.req.json();
  const { pin_code } = body;

  if (!pin_code) {
    return c.json({ success: false, error: "PIN code is required" }, 400);
  }

  // Extract client info
  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await setMerchantPin(
    supabase,
    merchantResult.merchant.merchant_id,
    pin_code,
    ipAddress,
    userAgent,
  );

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * PUT /merchants/pin - Update PIN code
 */
app.put("/pin", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant and check status
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  const body = await c.req.json();
  const { current_pin, new_pin } = body;

  if (!current_pin || !new_pin) {
    return c.json({ success: false, error: "Current PIN and new PIN are required" }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await updateMerchantPin(
    supabase,
    merchantResult.merchant.merchant_id,
    current_pin,
    new_pin,
    ipAddress,
    userAgent,
  );

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * DELETE /merchants/pin - Revoke PIN code
 */
app.delete("/pin", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant and check status
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  const body = await c.req.json();
  const { pin_code } = body;

  if (!pin_code) {
    return c.json({ success: false, error: "PIN code is required" }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await revokeMerchantPin(
    supabase,
    merchantResult.merchant.merchant_id,
    pin_code,
    ipAddress,
    userAgent,
  );

  return c.json(
    { success: result.success, message: result.message, error: result.error },
    result.success ? 200 : 400,
  );
});

/**
 * POST /merchants/pin/validate - Validate PIN code
 */
app.post("/pin/validate", dualAuthMiddleware, async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Get merchant (no status blocking for validation endpoint)
  const merchantQuery = supabase.from("merchants").select("merchant_id");
  const { data: merchant, error } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

  if (error || !merchant) {
    return c.json({ success: false, error: "Merchant not found" }, 404);
  }

  const body = await c.req.json();
  const { pin_code } = body;

  if (!pin_code) {
    return c.json({ success: false, error: "PIN code is required" }, 400);
  }

  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const result = await validatePinCode(
    supabase,
    merchant.merchant_id,
    pin_code,
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
