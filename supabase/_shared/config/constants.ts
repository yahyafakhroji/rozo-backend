/**
 * Application Constants
 * Centralized configuration for all magic values, TTLs, and status strings
 */

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
    MAX_LIMIT: 20,
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
      BASE_CHAIN_ID: "0x2105", // 8453
    },
  },

  // API endpoints
  API: {
    EXCHANGE_RATE_URL: "https://api.exchangerate-api.com/v4/latest/USD",
    PAYMENT_API_URL: "https://intentapiv2.rozo.ai/functions/v1/payment-api",
  },

  // Supported currencies for exchange rate updates
  SUPPORTED_CURRENCIES: ["MYR", "SGD", "IDR"] as const,
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
  "pending",
  "completed",
  "failed",
  "expired",
  "discrepancy",
] as const;

export type ValidOrderStatus = (typeof VALID_ORDER_STATUSES)[number];
