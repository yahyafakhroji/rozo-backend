/**
 * Profile Function Types
 * Uses database types for consistency
 */

import type { Tables } from "../../_shared/database.types.ts";

// ============================================================================
// Database Types (re-exported for convenience)
// ============================================================================

/** Merchant row from database */
export type Merchant = Tables<"merchants">;

/** Wallet row from database */
export type Wallet = Tables<"wallets">;

// ============================================================================
// Request Types
// ============================================================================

/** POST /profile - Create/update merchant request */
export interface CreateProfileRequest {
  email: string;
  display_name?: string;
  description?: string;
  logo_url?: string;
  default_currency?: string;
  default_language?: string;
}

/** PUT /profile - Update merchant request */
export interface UpdateProfileRequest {
  email?: string;
  display_name?: string;
  default_token_id?: string;
  logo?: string; // Base64 encoded image
}

// ============================================================================
// Response Data Types
// ============================================================================

/** Primary wallet info embedded in profile */
export interface PrimaryWallet {
  wallet_id: string;
  address: string;
  chain_id: string;
  label: string | null;
  source: string;
}

/** Profile data returned to clients (excludes sensitive PIN fields) */
export interface ProfileData {
  merchant_id: string;
  privy_id: string;
  email: string;
  display_name: string | null;
  logo_url: string | null;
  description: string | null;
  default_token_id: string;
  default_currency: string;
  default_language: string;
  status: string | null;
  has_pin: boolean;
  created_at: string;
  updated_at: string;
  primary_wallet: PrimaryWallet | null;
}

/** GET /profile/status response data */
export interface ProfileStatusData {
  status: string;
  has_pin: boolean;
  pin_attempts: number;
  pin_blocked_at: string | null;
}

/** POST /profile/pin/validate response data */
export interface PinValidationData {
  attempts_remaining: number;
  is_blocked: boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

/** Merchant with computed has_pin field (from middleware) */
export interface ResolvedMerchant extends Merchant {
  has_pin: boolean;
}

/** Client info extracted from request headers */
export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
}

/** Result from logo upload operation */
export interface UploadResult {
  url?: string;
  error?: string;
}
