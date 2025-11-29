/**
 * Cron Function
 * Consolidated cron jobs for expired orders and currency updates
 * Migrated from /expired-orders and /update-currencies to /cron/*
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, PaymentStatus } from "../../_shared/config/index.ts";

// Utils
import { createSupabaseClient } from "../../_shared/utils/supabase.utils.ts";

const app = new Hono().basePath("/cron");

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
// Constants
// ============================================================================

const CURRENCIES_TO_UPDATE = ["MYR", "SGD", "IDR"];
const BASE_CURRENCY = "USD";
const EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

// ============================================================================
// Expired Orders Helper Functions
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
        updatedOrders?.map((order) => order.number ?? "N/A").join(", "),
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
// Currency Update Helper Functions
// ============================================================================

/**
 * Fetches the latest currency exchange rates from ExchangeRate-API
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch exchange rates: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    throw error;
  }
}

/**
 * Updates currency rates in the database
 */
async function updateCurrencyRates(
  supabase: ReturnType<typeof createSupabaseClient>,
  rates: Record<string, number>,
): Promise<{ success: boolean; updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  for (const currencyId of CURRENCIES_TO_UPDATE) {
    try {
      // USD is always 1, convert rate to USD value
      const usdPrice = currencyId === BASE_CURRENCY ? 1 : 1 / rates[currencyId];

      const { error } = await supabase
        .from("currencies")
        .update({
          usd_price: usdPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("currency_id", currencyId);

      if (error) {
        throw error;
      }

      updated.push(currencyId);
    } catch (error) {
      console.error(`Error updating ${currencyId}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${currencyId}: ${errorMessage}`);
    }
  }

  return {
    success: errors.length === 0,
    updated,
    errors,
  };
}

// ============================================================================
// Expired Orders Route Handlers
// ============================================================================

/**
 * GET /cron/expired-orders/health - Health check
 */
app.get("/expired-orders/health", (c) => {
  return c.json({
    success: true,
    message: "Expired orders cron is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /cron/expired-orders/trigger - Manual trigger for testing
 */
app.post("/expired-orders/trigger", async (c) => {
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
 * POST /cron/expired-orders - Cron job endpoint (default)
 */
app.post("/expired-orders", async (c) => {
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

// ============================================================================
// Currency Update Route Handlers
// ============================================================================

/**
 * POST /cron/update-currencies - Cron job endpoint
 */
app.post("/update-currencies", async (c) => {
  try {
    const supabase = createSupabaseClient();

    // Fetch the latest exchange rates
    const rates = await fetchExchangeRates();

    // Update the currency rates in the database
    const result = await updateCurrencyRates(supabase, rates);

    return c.json({
      success: result.success,
      message: "Currency rates updated successfully",
      updated: result.updated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    }, result.success ? 200 : 207);
  } catch (error) {
    return c.json({
      success: false,
      message: "Failed to update currency rates",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Handle OPTIONS for CORS
app.options("*", (c) => c.text("ok"));

// Not found handler
app.notFound((c) => c.json({ error: "Route not found" }, 404));

// Export for Deno
Deno.serve(app.fetch);
