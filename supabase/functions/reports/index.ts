/**
 * Reports Function
 * Handles merchant dashboard reporting
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
import { validateDateRange, validateGroupBy } from "../../_shared/validators/common.validator.ts";

// Local report utilities
import { generateDashboardReport } from "./utils.ts";

const app = new Hono().basePath("/reports");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /reports - Get dashboard report
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(supabase, userProviderId, isPrivyAuth);
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse query parameters
  const from = c.req.query("from");
  const to = c.req.query("to");
  const groupByParam = c.req.query("group_by");

  // Validate date range
  const dateValidation = validateDateRange(from ?? null, to ?? null);
  if (!dateValidation.success) {
    return c.json({ success: false, error: dateValidation.error }, 400);
  }

  // Validate group_by parameter
  const groupByValidation = validateGroupBy(groupByParam ?? null);
  if (!groupByValidation.success) {
    return c.json({ success: false, error: groupByValidation.error }, 400);
  }

  // Generate report
  const result = await generateDashboardReport(
    supabase,
    merchantResult.merchant.merchant_id,
    {
      from: dateValidation.from!,
      to: dateValidation.to!,
      group_by: groupByValidation.groupBy,
    },
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }

  return c.json({ success: true, data: result.data });
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
