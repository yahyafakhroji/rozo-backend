/**
 * Devices Function
 * Handles device registration for push notifications
 * Refactored to use new middleware and type-safe utilities
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
  merchantResolverMiddleware,
  getMerchantFromContext,
} from "../../_shared/middleware/index.ts";

// Schemas
import {
  RegisterDeviceSchema,
  UnregisterDeviceSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

const app = new Hono().basePath("/devices");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /devices/register - Register device for push notifications
 */
app.post("/register", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse and validate request
  const body = await c.req.json();
  const validation = safeParseBody(RegisterDeviceSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const { device_id, fcm_token, platform } = validation.data;

  // Upsert device
  const { data, error } = await supabase
    .from("merchant_devices")
    .upsert(
      {
        merchant_id: merchant.merchant_id,
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
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse and validate request
  const body = await c.req.json();
  const validation = safeParseBody(UnregisterDeviceSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const { device_id } = validation.data;

  // Delete device
  const { error } = await supabase
    .from("merchant_devices")
    .delete()
    .match({
      merchant_id: merchant.merchant_id,
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
