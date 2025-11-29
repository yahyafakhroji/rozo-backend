/**
 * Wallets Function Types
 * Uses database types for consistency
 */

import type { Tables } from "../../_shared/database.types.ts";

// ============================================================================
// Database Types
// ============================================================================

/** Wallet row from database */
export type Wallet = Tables<"wallets">;

/** Chain row from database */
export type Chain = Tables<"chains">;

/** Token row from database */
export type Token = Tables<"tokens">;

// ============================================================================
// Request Types
// ============================================================================

/** POST /wallets - Add wallet request */
export interface AddWalletRequest {
  chain_id: string;
  address: string;
  label?: string;
  source?: string;
  is_primary?: boolean;
}

/** PUT /wallets/:walletId - Update wallet request */
export interface UpdateWalletRequest {
  label?: string;
  is_primary?: boolean;
}

/** POST /wallets/sync - Sync wallet request */
export interface SyncWalletRequest {
  chain_id?: string;
}

// ============================================================================
// Response Data Types
// ============================================================================

/** Wallet data returned to clients */
export interface WalletData {
  wallet_id: string;
  merchant_id: string;
  chain_id: string;
  address: string;
  label: string | null;
  source: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

/** Chain data returned to clients */
export interface ChainData {
  chain_id: string;
  name: string;
  chain_type: string;
  icon_url: string | null;
  explorer_url: string | null;
  is_active: boolean;
}

/** Token info for balance response */
export interface TokenInfo {
  token_name: string;
  token_address: string;
}

/** Balance entry from Privy */
export interface BalanceEntry {
  chain: string;
  asset: string;
  raw_value: string;
  raw_value_decimals: number;
  display_values: {
    [key: string]: string;
  };
}

/** GET /wallets/:walletId/balance response data */
export interface WalletBalanceData {
  wallet_id: string;
  address: string;
  chain_id: string;
  token: TokenInfo | null;
  asset: string;
  balances: BalanceEntry[];
}

