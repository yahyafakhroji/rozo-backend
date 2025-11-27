/**
 * Rate Limiting Utility
 * In-memory and database-backed rate limiting for API protection
 */

import type { TypedSupabaseClient } from "../types/common.types.ts";
import { RateLimitError } from "../middleware/error.middleware.ts";

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier type: 'merchant' or 'ip' */
  identifierType: "merchant" | "ip";
  /** Optional custom identifier function */
  getIdentifier?: (context: RateLimitContext) => string;
}

export interface RateLimitContext {
  merchantId?: string;
  ipAddress?: string;
  endpoint: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// ============================================================================
// In-Memory Rate Limiter (for edge functions)
// ============================================================================

/**
 * Simple in-memory rate limiter with automatic cleanup
 * Best for edge functions where database access adds latency
 */
class InMemoryRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: number | null = null;

  constructor(private cleanupIntervalMs = 60000) {
    // Cleanup expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs) as unknown as number;
  }

  /**
   * Check if request is allowed under rate limit
   */
  check(
    identifier: string,
    config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
  ): RateLimitResult {
    const now = Date.now();
    const key = identifier;
    const entry = this.limits.get(key);

    // No existing entry, create new one
    if (!entry) {
      this.limits.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now + config.windowMs),
      };
    }

    // Check if window has expired
    if (now - entry.windowStart >= config.windowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now + config.windowMs),
      };
    }

    // Window still active, check count
    const newCount = entry.count + 1;
    const remaining = Math.max(0, config.maxRequests - newCount);
    const resetAt = new Date(entry.windowStart + config.windowMs);

    if (newCount > config.maxRequests) {
      const retryAfterSeconds = Math.ceil(
        (entry.windowStart + config.windowMs - now) / 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      };
    }

    // Increment count
    entry.count = newCount;
    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const inMemoryLimiter = new InMemoryRateLimiter();

// ============================================================================
// Database-Backed Rate Limiter (for persistent limits)
// ============================================================================

/**
 * Database-backed rate limiter for persistent rate limiting
 * Use for critical endpoints where state must persist across function invocations
 */
export async function checkDatabaseRateLimit(
  supabase: TypedSupabaseClient,
  identifier: string,
  endpoint: string,
  config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    // Check existing rate limit entry
    const { data: existing, error: selectError } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("endpoint", endpoint)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // Error other than "not found"
      console.error("Rate limit check error:", selectError);
      // Fail open - allow request
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs),
      };
    }

    if (!existing) {
      // No existing entry, create new one
      await supabase.from("rate_limits").insert({
        identifier,
        endpoint,
        request_count: 1,
        window_start: now.toISOString(),
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs),
      };
    }

    // Check if window has expired
    const existingWindowStart = new Date(existing.window_start);
    if (existingWindowStart < windowStart) {
      // Window expired, reset
      await supabase
        .from("rate_limits")
        .update({
          request_count: 1,
          window_start: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("identifier", identifier)
        .eq("endpoint", endpoint);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs),
      };
    }

    // Window still active
    const newCount = existing.request_count + 1;
    const resetAt = new Date(
      existingWindowStart.getTime() + config.windowMs,
    );

    if (newCount > config.maxRequests) {
      const retryAfterSeconds = Math.ceil(
        (resetAt.getTime() - now.getTime()) / 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      };
    }

    // Increment count
    await supabase
      .from("rate_limits")
      .update({
        request_count: newCount,
        updated_at: now.toISOString(),
      })
      .eq("identifier", identifier)
      .eq("endpoint", endpoint);

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAt,
    };
  } catch (error) {
    console.error("Rate limit error:", error);
    // Fail open
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }
}

// ============================================================================
// Rate Limit Middleware Helpers
// ============================================================================

/**
 * Check in-memory rate limit and throw if exceeded
 */
export function checkRateLimit(
  identifier: string,
  config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
): RateLimitResult {
  const result = inMemoryLimiter.check(identifier, config);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}

/**
 * Rate limit by merchant ID
 */
export function rateLimitByMerchant(
  merchantId: string,
  endpoint: string,
  config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
): RateLimitResult {
  return checkRateLimit(`merchant:${merchantId}:${endpoint}`, config);
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(
  ipAddress: string,
  endpoint: string,
  config: Pick<RateLimitConfig, "maxRequests" | "windowMs">,
): RateLimitResult {
  return checkRateLimit(`ip:${ipAddress}:${endpoint}`, config);
}

// ============================================================================
// Preset Rate Limit Configurations
// ============================================================================

export const RATE_LIMITS = {
  /** Standard API endpoints: 100 requests per minute */
  STANDARD: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },

  /** Order creation: 30 requests per minute */
  ORDER_CREATE: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },

  /** Withdrawal operations: 10 requests per minute */
  WITHDRAWAL: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },

  /** PIN operations: 5 attempts per minute */
  PIN_ATTEMPT: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },

  /** Report generation: 10 requests per minute */
  REPORTS: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },

  /** Webhook endpoints: 1000 requests per minute */
  WEBHOOK: {
    maxRequests: 1000,
    windowMs: 60 * 1000,
  },
} as const;

// ============================================================================
// Cleanup Function for Tests
// ============================================================================

/**
 * Reset all in-memory rate limits (for testing)
 */
export function resetAllRateLimits(): void {
  // Create new limiter instance
  inMemoryLimiter.destroy();
}
