/**
 * Expired Orders Cron Job
 * Handles expired orders by updating their status to EXPIRED
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, PaymentStatus } from "../../_shared/config/index.ts";

// Utils
import { createSupabaseClient } from "../../_shared/utils/supabase.utils.ts";

const app = new Hono().basePath("/expired-orders");

// Apply CORS
app.use("*", cors(corsConfig));

// ============================================================================
// Types
// ============================================================================

interface ExpiredOrderStats {
  totalExpired: number;
  updatedOrders: number;
  errors: number;
  processingTimeMs: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle expired orders by updating their status to EXPIRED
 */
async function handleExpiredOrders(supabase: ReturnType<typeof createSupabaseClient>): Promise<ExpiredOrderStats> {
  const startTime = Date.now();
  const stats: ExpiredOrderStats = {
    totalExpired: 0,
    updatedOrders: 0,
    errors: 0,
    processingTimeMs: 0,
  };

  try {
    const now = new Date().toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Update all expired orders in one query
    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({
        status: PaymentStatus.EXPIRED,
        updated_at: now,
      })
      .eq("status", PaymentStatus.PENDING)
      .or(`expired_at.lt.${now},and(expired_at.is.null,created_at.lt.${tenMinutesAgo})`)
      .select("order_id, number");

    if (updateError) {
      console.error("Error updating expired orders:", updateError);
      stats.errors++;
      return stats;
    }

    stats.totalExpired = updatedOrders?.length || 0;
    stats.updatedOrders = stats.totalExpired;

    if (stats.totalExpired > 0) {
      console.log(
        `Updated ${stats.totalExpired} expired orders:`,
        updatedOrders?.map((order: { number: string }) => order.number).join(", "),
      );
    } else {
      console.log("No expired orders found");
    }
  } catch (error) {
    console.error("Unexpected error in handleExpiredOrders:", error);
    stats.errors++;
  } finally {
    stats.processingTimeMs = Date.now() - startTime;
  }

  return stats;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /expired-orders/health - Health check
 */
app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "Expired orders cron is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /expired-orders/trigger - Manual trigger for testing
 */
app.post("/trigger", async (c) => {
  try {
    const supabase = createSupabaseClient();
    const stats = await handleExpiredOrders(supabase);

    return c.json({
      success: true,
      message: "Expired orders processed manually",
      stats,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

/**
 * POST /expired-orders - Cron job endpoint (default)
 */
app.post("/", async (c) => {
  try {
    const supabase = createSupabaseClient();
    const stats = await handleExpiredOrders(supabase);

    return c.json({
      success: true,
      message: "Expired orders processed",
      stats,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

// Not found handler
app.notFound((c) => c.json({ error: "Route not found" }, 404));

// Export for Deno
Deno.serve(app.fetch);
