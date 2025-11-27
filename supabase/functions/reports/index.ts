/**
 * Reports Function
 * Handles merchant dashboard reporting
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
  ReportRequestSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

// Local report utilities
import { generateDashboardReport, getQuickStats } from "./utils.ts";

const app = new Hono().basePath("/reports");

// Apply middleware stack
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /reports - Get dashboard report
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Parse query parameters
  const from = c.req.query("from");
  const to = c.req.query("to");
  const groupBy = c.req.query("group_by");

  // Validate with Zod schema
  const validation = safeParseBody(ReportRequestSchema, {
    from,
    to,
    group_by: groupBy,
  });

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Generate report
  const result = await generateDashboardReport(
    supabase,
    merchant.merchant_id,
    validation.data,
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }

  return c.json({ success: true, data: result.data });
});

/**
 * GET /reports/quick-stats - Get quick summary stats
 */
app.get("/quick-stats", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  const result = await getQuickStats(supabase, merchant.merchant_id);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }

  return c.json({ success: true, data: result.data });
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
