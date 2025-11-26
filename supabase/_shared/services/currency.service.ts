/**
 * Currency Service
 * Currency rate caching and conversion utilities
 */

import { CONSTANTS } from "../config/constants.ts";
import type { TypedSupabaseClient } from "../utils/supabase.utils.ts";
import type { CurrencyConversionResult } from "../types/api.types.ts";

interface CurrencyRate {
  currency_id: string;
  usd_price: number;
  cached_at: number;
  ttl: number;
}

/**
 * Currency Cache Class
 * Provides in-memory caching for currency conversion rates with TTL
 */
class CurrencyCache {
  private cache = new Map<string, CurrencyRate>();
  private readonly DEFAULT_TTL = CONSTANTS.CACHE.CURRENCY_TTL_MS;
  private readonly MAX_CACHE_SIZE = CONSTANTS.CACHE.MAX_ENTRIES;

  /**
   * Get currency rate from cache or fetch from database
   */
  async getCurrencyRate(
    supabase: TypedSupabaseClient,
    currencyId: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<{ success: boolean; rate?: number; error?: string }> {
    try {
      // Check cache first
      const cached = this.cache.get(currencyId);
      if (cached && this.isValid(cached)) {
        return { success: true, rate: cached.usd_price };
      }

      // Fetch from database
      const { data: currency, error } = await supabase
        .from("currencies")
        .select("usd_price")
        .eq("currency_id", currencyId)
        .single();

      if (error || !currency) {
        return { success: false, error: "Currency not found" };
      }

      // Cache the result
      this.setCache(currencyId, currency.usd_price, ttl);

      return { success: true, rate: currency.usd_price };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Convert amount from any currency to USD
   */
  async convertToUSD(
    supabase: TypedSupabaseClient,
    currencyId: string,
    amount: number,
  ): Promise<CurrencyConversionResult> {
    // Skip conversion for USD
    if (currencyId === "USD") {
      return { success: true, usdAmount: amount };
    }

    const rateResult = await this.getCurrencyRate(supabase, currencyId);
    if (!rateResult.success || rateResult.rate === undefined) {
      return { success: false, error: rateResult.error };
    }

    const usdAmount = rateResult.rate * amount;
    return { success: true, usdAmount };
  }

  /**
   * Check if cached rate is still valid
   */
  private isValid(cached: CurrencyRate): boolean {
    return Date.now() - cached.cached_at < cached.ttl;
  }

  /**
   * Set currency rate in cache
   */
  private setCache(currencyId: string, usdPrice: number, ttl: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(currencyId, {
      currency_id: currencyId,
      usd_price: usdPrice,
      cached_at: Date.now(),
      ttl,
    });
  }

  /**
   * Clear expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.cached_at >= value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Global cache instance
export const currencyCache = new CurrencyCache();

// Cleanup expired entries periodically
setInterval(() => {
  currencyCache.cleanup();
}, CONSTANTS.CACHE.CLEANUP_INTERVAL_MS);

/**
 * Convert currency amount to USD using cached rates
 */
export async function convertCurrencyToUSD(
  supabase: TypedSupabaseClient,
  currency: string,
  amount: number,
): Promise<CurrencyConversionResult> {
  try {
    const result = await currencyCache.convertToUSD(supabase, currency, amount);

    if (!result.success || result.usdAmount === undefined) {
      return { success: false, error: result.error };
    }

    // Validate minimum amount
    if (result.usdAmount < CONSTANTS.ORDER.MIN_AMOUNT_USD) {
      return {
        success: false,
        error: `Cannot create order with amount less than ${CONSTANTS.ORDER.MIN_AMOUNT_USD} USD`,
      };
    }

    return {
      success: true,
      usdAmount: parseFloat(result.usdAmount.toFixed(2)),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Currency conversion failed",
    };
  }
}

/**
 * Fetch exchange rates from external API
 */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  const response = await fetch(CONSTANTS.API.EXCHANGE_RATE_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch exchange rates: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.rates;
}

/**
 * Update currency rates in the database
 */
export async function updateCurrencyRates(
  supabase: TypedSupabaseClient,
  rates: Record<string, number>,
): Promise<{ success: boolean; updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  for (const currencyId of CONSTANTS.SUPPORTED_CURRENCIES) {
    try {
      // Convert to USD value (e.g., 1 USD = X Currency)
      const usdPrice = currencyId === "USD" ? 1 : 1 / rates[currencyId];

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
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      errors.push(`${currencyId}: ${errorMessage}`);
    }
  }

  return {
    success: errors.length === 0,
    updated,
    errors,
  };
}

export { CurrencyCache };
