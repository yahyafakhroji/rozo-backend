/**
 * Transaction Factory
 * Abstracts common logic for order and deposit creation
 */

import { CONSTANTS } from "../config/constants.ts";
import type {
  DaimoPayment,
  MerchantData,
  TokenData,
  TypedSupabaseClient,
} from "../types/common.types.ts";
import { resolvePreferredToken, getDestinationAddress } from "../services/merchant.service.ts";
import { convertCurrencyToUSD } from "../services/currency.service.ts";
import { createOrderPaymentLink, createDepositPaymentLink } from "../services/payment.service.ts";
import { generateOrderNumber } from "../utils/helpers.ts";

// ============================================================================
// Types
// ============================================================================

export type TransactionType = "order" | "deposit";

export interface CreateTransactionInput {
  display_currency: string;
  display_amount: number;
  description?: string;
  redirect_uri?: string;
  preferred_token_id?: string;
}

export interface CreateTransactionOptions {
  supabase: TypedSupabaseClient;
  merchant: MerchantData;
  input: CreateTransactionInput;
  type: TransactionType;
}

export interface TransactionResult {
  success: boolean;
  paymentDetail?: DaimoPayment;
  record_id?: string;
  number?: string;
  expired_at?: string;
  error?: string;
  code?: string;
}

interface TransactionRecord {
  order_id?: string;
  deposit_id?: string;
  number: string;
  expired_at?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a transaction (order or deposit)
 * Unified factory that handles the common flow:
 * 1. Convert currency to USD
 * 2. Resolve tokens
 * 3. Generate transaction number
 * 4. Create payment link
 * 5. Insert record
 */
export async function createTransaction(
  options: CreateTransactionOptions,
): Promise<TransactionResult> {
  const { supabase, merchant, input, type } = options;

  try {
    // Step 1: Convert currency to USD
    const conversionResult = await convertCurrencyToUSD(
      supabase,
      input.display_currency,
      input.display_amount,
    );

    if (!conversionResult.success || !conversionResult.usdAmount) {
      return {
        success: false,
        error: conversionResult.error || "Currency conversion failed",
      };
    }

    // Step 2: Resolve destination token (merchant's default)
    const destinationTokenResult = await resolvePreferredToken(
      supabase,
      merchant.default_token_id,
    );

    if (!destinationTokenResult.success || !destinationTokenResult.token) {
      return {
        success: false,
        error: destinationTokenResult.error || "Failed to resolve destination token",
      };
    }

    // Step 3: Resolve preferred token (only for orders)
    let preferredToken = destinationTokenResult.token;
    if (type === "order" && input.preferred_token_id) {
      const preferredTokenResult = await resolvePreferredToken(
        supabase,
        merchant.default_token_id,
        input.preferred_token_id,
      );

      if (!preferredTokenResult.success || !preferredTokenResult.token) {
        return {
          success: false,
          error: preferredTokenResult.error || "Failed to resolve preferred token",
        };
      }
      preferredToken = preferredTokenResult.token;
    }

    // Step 4: Generate transaction number
    const transactionNumber = generateOrderNumber();

    // Step 5: Create payment link
    const paymentResult = type === "order"
      ? await createOrderPaymentLink(
          merchant,
          input,
          transactionNumber,
          conversionResult.usdAmount,
          destinationTokenResult.token,
          preferredToken,
        )
      : await createDepositPaymentLink(
          merchant,
          input,
          transactionNumber,
          conversionResult.usdAmount,
          destinationTokenResult.token,
        );

    if (!paymentResult.success || !paymentResult.paymentDetail) {
      return {
        success: false,
        error: paymentResult.error || "Payment link creation failed",
      };
    }

    // Step 6: Insert record
    const insertResult = type === "order"
      ? await insertOrderRecord(
          supabase,
          merchant,
          input,
          transactionNumber,
          paymentResult.paymentDetail,
          conversionResult.usdAmount,
          destinationTokenResult.token,
        )
      : await insertDepositRecord(
          supabase,
          merchant,
          input,
          transactionNumber,
          paymentResult.paymentDetail,
          conversionResult.usdAmount,
          destinationTokenResult.token,
        );

    if (!insertResult.success || !insertResult.record) {
      return {
        success: false,
        error: insertResult.error || "Failed to insert record",
      };
    }

    const recordId = type === "order"
      ? insertResult.record.order_id
      : insertResult.record.deposit_id;

    return {
      success: true,
      paymentDetail: paymentResult.paymentDetail,
      record_id: recordId,
      number: insertResult.record.number,
      expired_at: insertResult.record.expired_at,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction creation failed",
    };
  }
}

// ============================================================================
// Record Insertion Helpers
// ============================================================================

/**
 * Insert order record into database
 */
async function insertOrderRecord(
  supabase: TypedSupabaseClient,
  merchant: MerchantData,
  input: CreateTransactionInput,
  orderNumber: string,
  paymentDetail: DaimoPayment,
  usdAmount: number,
  destinationToken: TokenData,
): Promise<{ success: boolean; record?: TransactionRecord; error?: string }> {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CONSTANTS.ORDER.EXPIRY_MINUTES * 60 * 1000,
  );

  const destinationAddress = getDestinationAddress(merchant);
  if (!destinationAddress) {
    return { success: false, error: "Destination address not found" };
  }

  const orderToInsert = {
    number: orderNumber,
    merchant_id: merchant.merchant_id,
    payment_id: paymentDetail.id,
    merchant_chain_id: destinationToken.chain_id,
    merchant_address: destinationAddress,
    required_amount_usd: usdAmount,
    required_token: destinationToken.token_address,
    preferred_token_id: input.preferred_token_id,
    display_currency: input.display_currency,
    display_amount: input.display_amount,
    description: input.description,
    status: CONSTANTS.STATUS.PAYMENT.PENDING,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expired_at: expiresAt.toISOString(),
    payment_data: paymentDetail,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderToInsert)
    .select("order_id, number, expired_at")
    .single();

  if (orderError) {
    return { success: false, error: orderError.message };
  }

  return { success: true, record: order };
}

/**
 * Insert deposit record into database
 */
async function insertDepositRecord(
  supabase: TypedSupabaseClient,
  merchant: MerchantData,
  input: CreateTransactionInput,
  depositNumber: string,
  paymentDetail: DaimoPayment,
  usdAmount: number,
  token: TokenData,
): Promise<{ success: boolean; record?: TransactionRecord; error?: string }> {
  const destinationAddress = getDestinationAddress(merchant);
  if (!destinationAddress) {
    return { success: false, error: "Destination address not found" };
  }

  const now = new Date().toISOString();
  const depositToInsert = {
    merchant_id: merchant.merchant_id,
    payment_id: paymentDetail.id,
    merchant_chain_id: token.chain_id,
    merchant_address: destinationAddress,
    required_amount_usd: usdAmount,
    required_token: token.token_address,
    display_amount: input.display_amount,
    display_currency: input.display_currency,
    status: CONSTANTS.STATUS.PAYMENT.PENDING,
    created_at: now,
    updated_at: now,
    number: depositNumber,
  };

  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .insert(depositToInsert)
    .select("deposit_id, number")
    .single();

  if (depositError) {
    return { success: false, error: depositError.message };
  }

  return { success: true, record: deposit };
}

// ============================================================================
// Regenerate Payment Link
// ============================================================================

export interface RegeneratePaymentOptions {
  supabase: TypedSupabaseClient;
  merchant: MerchantData;
  orderId: string;
  newPreferredTokenId?: string;
}

/**
 * Regenerate payment link for an existing PENDING order
 */
export async function regenerateOrderPaymentLink(
  options: RegeneratePaymentOptions,
): Promise<TransactionResult> {
  const { supabase, merchant, orderId, newPreferredTokenId } = options;

  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .eq("merchant_id", merchant.merchant_id)
      .single();

    if (orderError || !order) {
      return {
        success: false,
        error: "Order not found or does not belong to merchant",
      };
    }

    // Validate order status
    if (order.status !== CONSTANTS.STATUS.PAYMENT.PENDING) {
      return {
        success: false,
        error: `Cannot regenerate payment for order with status: ${order.status}. Only PENDING orders can regenerate payment.`,
      };
    }

    // Determine preferred token
    const preferredTokenIdToUse = newPreferredTokenId ?? order.preferred_token_id;

    // Resolve tokens
    const destinationTokenResult = await resolvePreferredToken(
      supabase,
      merchant.default_token_id,
    );

    if (!destinationTokenResult.success || !destinationTokenResult.token) {
      return {
        success: false,
        error: destinationTokenResult.error || "Failed to resolve destination token",
      };
    }

    const preferredTokenResult = await resolvePreferredToken(
      supabase,
      merchant.default_token_id,
      preferredTokenIdToUse,
    );

    if (!preferredTokenResult.success || !preferredTokenResult.token) {
      return {
        success: false,
        error: preferredTokenResult.error || "Failed to resolve preferred token",
      };
    }

    // Create new payment link
    const paymentResult = await createOrderPaymentLink(
      merchant,
      {
        display_currency: order.display_currency,
        display_amount: order.display_amount,
        description: order.description,
        preferred_token_id: preferredTokenIdToUse,
      },
      order.number,
      order.required_amount_usd,
      destinationTokenResult.token,
      preferredTokenResult.token,
    );

    if (!paymentResult.success || !paymentResult.paymentDetail) {
      return {
        success: false,
        error: paymentResult.error || "Payment link creation failed",
      };
    }

    // Update order
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + CONSTANTS.ORDER.EXPIRY_MINUTES * 60 * 1000,
    );

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_id: paymentResult.paymentDetail.id,
        payment_data: paymentResult.paymentDetail,
        preferred_token_id: preferredTokenIdToUse,
        status: CONSTANTS.STATUS.PAYMENT.PENDING,
        expired_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("order_id", orderId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      paymentDetail: paymentResult.paymentDetail,
      record_id: orderId,
      expired_at: expiresAt.toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment regeneration failed",
    };
  }
}
