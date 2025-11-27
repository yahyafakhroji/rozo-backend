/**
 * Update Currencies Cron Job
 * Fetches latest exchange rates and updates the database
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

// Utils
import { createSupabaseClient } from "../../_shared/utils/supabase.utils.ts";

const app = new Hono().basePath("/update-currencies");

// Apply CORS
app.use("*", cors(corsConfig));

// ============================================================================
// Constants
// ============================================================================

const CURRENCIES_TO_UPDATE = ["MYR", "SGD", "IDR"];
const BASE_CURRENCY = "USD";
const EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

// ============================================================================
// Helper Functions
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
// Route Handlers
// ============================================================================

/**
 * POST /update-currencies - Cron job endpoint
 */
app.post("/", async (c) => {
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

// Not allowed methods
app.all("*", (c) => c.json({ error: "Method not allowed" }, 405));

// Export for Deno
Deno.serve(app.fetch);
