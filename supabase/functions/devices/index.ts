/**
 * Devices Function
 * Handles device registration for push notifications
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
import { validateMerchant } from "../../_shared/services/merchant.service.ts";

// Validators
import { validateDeviceRegistrationRequest } from "../../_shared/validators/order.validator.ts";

const app = new Hono().basePath("/devices");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /devices/register - Register device for push notifications
 */
app.post("/register", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse and validate request
  const body = await c.req.json();
  const validation = validateDeviceRegistrationRequest(body);
  if (!validation.success || !validation.data) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const { device_id, fcm_token, platform } = validation.data;

  // Upsert device
  const { data, error } = await supabase
    .from("merchant_devices")
    .upsert(
      {
        merchant_id: merchantResult.merchant.merchant_id,
        device_id,
        fcm_token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,merchant_id" },
    )
    .select()
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({
    success: true,
    data,
    message: "Device registered successfully",
  });
});

/**
 * DELETE /devices/unregister - Unregister device
 */
app.delete("/unregister", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse request
  const body = await c.req.json();
  const { device_id } = body;

  if (!device_id) {
    return c.json(
      { success: false, error: "Missing required field: device_id" },
      400,
    );
  }

  // Delete device
  const { error } = await supabase
    .from("merchant_devices")
    .delete()
    .match({
      merchant_id: merchantResult.merchant.merchant_id,
      device_id,
    });

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({
    success: true,
    message: "Device unregistered successfully",
  });
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
