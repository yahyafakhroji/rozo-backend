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
  errorMiddleware,
  getMerchantFromContext,
  merchantResolverMiddleware,
  notFoundHandler,
  privyAuthMiddleware,
} from "../../_shared/middleware/index.ts";

// Schemas
import {
  RegisterDeviceSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { ApiResponse } from "../../_shared/types/api.types.ts";
import type { DeviceData } from "./types.ts";

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath("/devices");

// Global middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", privyAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /devices - Register device for push notifications
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  const validation = safeParseBody(RegisterDeviceSchema, await c.req.json());
  if (!validation.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: validation.error,
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const { device_id, fcm_token, platform } = validation.data;

  const { data, error } = await supabase
    .from("devices")
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
    return c.json<ApiResponse<null>>({
      success: false,
      error: error.message,
      code: "DATABASE_ERROR",
    }, 500);
  }

  return c.json<ApiResponse<DeviceData>>({
    success: true,
    data: data as DeviceData,
    message: "Device registered successfully",
  }, 201);
});

/**
 * DELETE /devices/:deviceId - Unregister device
 */
app.delete("/:deviceId", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const deviceId = c.req.param("deviceId");

  if (!deviceId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Device ID is required",
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const { error } = await supabase
    .from("devices")
    .delete()
    .match({
      merchant_id: merchant.merchant_id,
      device_id: deviceId,
    });

  if (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: error.message,
      code: "DATABASE_ERROR",
    }, 500);
  }

  return c.json<ApiResponse<null>>({
    success: true,
    message: "Device unregistered successfully",
  });
});

// Not found handler
app.notFound(notFoundHandler);

// Export
Deno.serve(app.fetch);
