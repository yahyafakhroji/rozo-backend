/**
 * Common Types
 * Shared interfaces and types used across the application
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../database.types.ts";

// Supabase client type
export type TypedSupabaseClient = SupabaseClient<Database>;

// ============================================================================
// Merchant Types
// ============================================================================

export interface MerchantData {
  merchant_id: string;
  privy_id: string;
  email?: string;
  display_name?: string;
  description?: string;
  logo_url?: string;
  wallet_address: string;
  stellar_address?: string;
  default_currency?: string;
  default_token_id: string;
  default_language?: string;
  status: string;
  pin_code_hash?: string | null;
  pin_code_attempts?: number;
  pin_code_blocked_at?: string | null;
  pin_code_last_attempt_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MerchantValidationResult {
  success: boolean;
  merchant?: MerchantData;
  error?: string;
  code?: string;
}

export interface MerchantPinData {
  merchant_id: string;
  pin_code_hash: string | null;
  pin_code_attempts: number;
  status: string;
  pin_code_blocked_at: string | null;
}

export interface MerchantStatus {
  status: string;
  is_blocked: boolean;
  has_pin: boolean;
  pin_attempts: number;
  pin_blocked_at: string | null;
}

// ============================================================================
// Chain Types
// ============================================================================

export interface ChainData {
  chain_id: string;
  name: string;
  chain_type: "evm" | "stellar" | "solana";
  icon_url?: string | null;
  explorer_url?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Token Types
// ============================================================================

export interface TokenData {
  token_id: string;
  token_name: string;
  token_address: string;
  chain_id: string;
  chain_name: string;
  icon_url?: string | null;
  is_active?: boolean;
  decimals?: number;
}

// ============================================================================
// Merchant Wallet Types
// ============================================================================

export type WalletSource = "privy" | "manual";

export interface MerchantWalletData {
  wallet_id: string;
  merchant_id: string;
  chain_id: string;
  address: string;
  label?: string | null;
  source: WalletSource;
  is_primary: boolean;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined data
  chain?: ChainData;
}

export interface AddMerchantWalletRequest {
  chain_id: string;
  address: string;
  label?: string;
  source?: WalletSource;
  is_primary?: boolean;
}

export interface UpdateMerchantWalletRequest {
  label?: string;
  is_primary?: boolean;
}

export interface MerchantWalletResult {
  success: boolean;
  wallet?: MerchantWalletData;
  wallets?: MerchantWalletData[];
  error?: string;
}

// ============================================================================
// Order Types
// ============================================================================

export interface OrderData {
  number: string;
  merchant_id: string;
  payment_id: string;
  required_amount_usd: number;
  merchant_chain_id: string;
  merchant_address: string;
  display_currency: string;
  display_amount: number;
}

export interface Order extends OrderData {
  order_id?: string;
  required_token?: string;
  preferred_token_id?: string;
  description?: string;
  redirect_uri?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  expired_at?: string;
  payment_data?: unknown;
  callback_payload?: unknown;
  source_txn_hash?: string;
  source_chain_name?: string;
  source_token_address?: string;
  source_token_amount?: number;
}

export interface CreateOrderRequest {
  display_currency: string;
  display_amount: number;
  description?: string;
  redirect_uri?: string;
  preferred_token_id?: string;
}

// ============================================================================
// Deposit Types
// ============================================================================

export interface CreateDepositRequest {
  display_amount: number;
  display_currency: string;
  redirect_uri?: string;
}

export interface Deposit {
  deposit_id?: string;
  merchant_id: string;
  payment_id: string;
  merchant_chain_id: number;
  merchant_address: string;
  required_amount_usd: number;
  required_token: string;
  display_amount: number;
  display_currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  number: string;
}

// ============================================================================
// Withdrawal Types
// ============================================================================

export interface CreateWithdrawalRequest {
  recipient: string;
  amount: number;
  currency: string;
}

export interface Withdrawal {
  withdrawal_id: string;
  merchant_id: string;
  recipient: string;
  amount: number;
  currency: string;
  tx_hash?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Device Types
// ============================================================================

export interface RegisterDeviceRequest {
  device_id: string;
  fcm_token: string;
  platform: "ios" | "android";
}

export interface UnregisterDeviceRequest {
  device_id: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface DaimoPayment {
  id: string;
  status: string;
  createdAt: string;
  display: {
    intent: string;
    paymentValue: string;
    currency: string;
  };
  source: unknown | null;
  destination: {
    destinationAddress: string;
    txHash: string | null;
    chainId: string;
    amountUnits: string;
    tokenSymbol: string;
    tokenAddress: string;
    callData: string;
  };
  externalId: string;
  metadata: Record<string, unknown>;
}

export interface DaimoPaymentResponse {
  success: boolean;
  paymentDetail: DaimoPayment | null;
  error?: string;
}

export interface CreatePaymentLinkProps {
  intent: string;
  destinationAddress: string;
  amountUnits: string;
  orderNumber: string;
  description?: string;
  redirect_uri?: string;
  destinationToken: TokenData;
  preferredToken: TokenData;
  isOrder?: boolean;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ReportRequest {
  from: string;
  to: string;
  group_by?: "day" | "week" | "month";
}

export interface ChartData {
  merchant_id: string;
  date_range: { from: string; to: string };
  summary: {
    total_completed_orders: number;
    total_required_amount_usd: number;
    total_display_amounts: Record<string, number>;
  };
  charts: {
    daily_trends: DailyTrend[];
    currency_breakdown: CurrencyBreakdown[];
    order_volume: OrderVolume[];
  };
}

export interface DailyTrend {
  date: string;
  orders_count: number;
  usd_amount: number;
  display_amounts: Record<string, number>;
}

export interface CurrencyBreakdown {
  currency: string;
  amount: number;
  percentage: number;
}

export interface OrderVolume {
  date: string;
  count: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface DaimoWebhookEvent {
  event:
    | "payment_started"
    | "payment.completed"
    | "payment_completed"
    | "payment_bounced"
    | "payment_refunded";
  timestamp: string;
  payment: {
    id: string;
    token: string | null;
    amount: string | null;
    status: string;
    metadata: {
      appId: string;
      items: Array<{
        name: string;
        description: string;
      }>;
      payer: Record<string, unknown>;
      intent: string;
      orderDate: string;
      webhookUrl: string;
      block_number: number;
      orderNumber: string;
      from_address: string;
      actual_amount: string;
      merchantToken: string;
      webhook_source: string;
      transaction_hash: string;
      webhook_detected: boolean;
      webhook_event_id: string;
      webhook_timestamp: string;
      monitoring_attempts: number;
    };
    created_at: string;
    updated_at: string;
    external_id: string | null;
    source_data: unknown;
    completed_at: string;
    display_data: {
      name: string;
      logoUrl: string;
      description: string;
    };
    payinchainid: string;
    source_chain: string | null;
    payout_success: boolean | null;
    refund_address: string | null;
    destination_data: {
      chainId: string;
      amountUnits: string;
      tokenAddress: string;
      destinationAddress: string;
    };
    source_ecosystem: string | null;
    destination_chain: string;
    payintokenaddress: string;
    receiving_address: string;
    payout_processed_at: string | null;
    destination_ecosystem: string;
    payout_transaction_hash: string | null;
  };
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletResponse {
  id: string;
  address: string;
  chain_type: string;
  policy_ids: string[];
  additional_signers: string[];
  owner_id: string;
  created_at: number;
  exported_at: string | null;
  imported_at: string | null;
}

export interface TransactionConfig {
  recipientAddress: string;
  amountToSend: number;
  decimals: number;
  usdcContractAddress: string;
  chainId: string;
  policyId: string;
  authorizationPrivateKey: string;
}

export interface TransactionRequest {
  recipientAddress: string;
  amount: number;
  signature: string;
  requestId?: string;
}

export interface TransactionResult {
  hash: string;
  caip2: string;
  walletId: string;
}
