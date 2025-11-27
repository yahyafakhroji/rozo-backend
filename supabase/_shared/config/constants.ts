/**
 * Application Constants
 * Centralized configuration for all magic values, TTLs, and status strings
 */

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = Deno.env.get(key);
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || "";
}

/**
 * Get optional environment variable
 */
function getOptionalEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

// ============================================================================
// Dynamic Configuration (from environment)
// ============================================================================

/**
 * Get the payment callback URL
 * Constructs from ROZO_SUPABASE_URL or uses explicit PAYMENT_CALLBACK_URL
 */
export function getPaymentCallbackUrl(): string {
  const explicitUrl = getOptionalEnv("PAYMENT_CALLBACK_URL");
  if (explicitUrl) {
    return explicitUrl;
  }

  const supabaseUrl = getOptionalEnv("ROZO_SUPABASE_URL");
  if (supabaseUrl) {
    // Extract project ref from URL: https://<project-ref>.supabase.co
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      return `https://${match[1]}.supabase.co/functions/v1/payment-callback`;
    }
  }

  // Fallback to hardcoded value (should be replaced in production)
  console.warn("Using hardcoded payment callback URL. Set PAYMENT_CALLBACK_URL in production.");
  return "https://iufqieirueyalyxfzszh.supabase.co/functions/v1/payment-callback";
}

/**
 * Get the Rozo Pay URL for QR codes
 */
export function getRozoPayUrl(): string {
  return getEnv("ROZO_PAY_URL", "https://pay.rozo.ai/");
}

/**
 * Get the payment API URL
 */
export function getPaymentApiUrl(): string {
  return getEnv("PAYMENT_API_URL", "https://intentapiv2.rozo.ai/functions/v1/payment-api");
}

/**
 * Get the exchange rate API URL
 */
export function getExchangeRateApiUrl(): string {
  return getEnv("EXCHANGE_RATE_API_URL", "https://api.exchangerate-api.com/v4/latest/USD");
}

// ============================================================================
// Static Configuration
// ============================================================================

export const CONSTANTS = {
  // Cache configuration
  CACHE: {
    CURRENCY_TTL_MS: 5 * 60 * 1000, // 5 minutes
    MAX_ENTRIES: 100,
    CLEANUP_INTERVAL_MS: 60 * 1000, // 1 minute
    TRANSACTION_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  },

  // Order configuration
  ORDER: {
    EXPIRY_MINUTES: 10,
    MIN_AMOUNT_USD: 0.1,
  },

  // PIN configuration
  PIN: {
    LENGTH: 6,
    MAX_ATTEMPTS: 3,
    BCRYPT_SALT_ROUNDS: 12,
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    DEFAULT_OFFSET: 0,
  },

  // Status strings
  STATUS: {
    MERCHANT: {
      ACTIVE: "ACTIVE",
      INACTIVE: "INACTIVE",
      PIN_BLOCKED: "PIN_BLOCKED",
    } as const,
    PAYMENT: {
      PENDING: "PENDING",
      PROCESSING: "PROCESSING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      EXPIRED: "EXPIRED",
      DISCREPANCY: "DISCREPANCY",
    } as const,
  },

  // Default values
  DEFAULTS: {
    TOKEN_ID: "USDC_BASE",
    INTENT_TITLE: "Rozo",
  },

  // Token configuration
  TOKEN: {
    USDC: {
      DECIMALS: 6,
      BASE_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      BASE_CHAIN_ID: "0x2105", // 8453 in hex
      BASE_CHAIN_ID_DECIMAL: 8453,
    },
  },

  // API endpoints (use getter functions for dynamic values)
  API: {
    get EXCHANGE_RATE_URL() {
      return getExchangeRateApiUrl();
    },
    get PAYMENT_API_URL() {
      return getPaymentApiUrl();
    },
    get PAYMENT_CALLBACK_URL() {
      return getPaymentCallbackUrl();
    },
    get ROZO_PAY_URL() {
      return getRozoPayUrl();
    },
  },

  // Supported currencies for exchange rate updates
  SUPPORTED_CURRENCIES: ["MYR", "SGD", "IDR", "PHP", "THB", "VND"] as const,
} as const;

// Payment status enum for type safety
export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  DISCREPANCY = "DISCREPANCY",
}

// Merchant status enum for type safety
export enum MerchantStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PIN_BLOCKED = "PIN_BLOCKED",
}

// Status hierarchy for proper state transitions
export const STATUS_HIERARCHY: Record<PaymentStatus, number> = {
  [PaymentStatus.PENDING]: 0,
  [PaymentStatus.PROCESSING]: 1,
  [PaymentStatus.COMPLETED]: 2,
  [PaymentStatus.FAILED]: 2,
  [PaymentStatus.EXPIRED]: 2,
  [PaymentStatus.DISCREPANCY]: 2,
};

// Valid status values for filtering
export const VALID_ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "DISCREPANCY",
] as const;

export type ValidOrderStatus = (typeof VALID_ORDER_STATUSES)[number];
