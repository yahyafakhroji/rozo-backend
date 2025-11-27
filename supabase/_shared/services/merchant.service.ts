/**
 * Merchant Service
 * Centralized merchant operations and validation
 */

import { CONSTANTS, MerchantStatus } from "../config/constants.ts";
import type {
  MerchantData,
  MerchantPinData,
  MerchantValidationResult,
  TokenData,
} from "../types/common.types.ts";
import type { TypedSupabaseClient } from "../utils/supabase.utils.ts";
import { hashPinCode, validatePinCodeInput, verifyPinCode } from "../utils/hash.utils.ts";
import type {
  PinManagementResult,
  PinValidationResult,
} from "../types/api.types.ts";

/**
 * Validate merchant exists, is active, and return merchant data
 */
export async function validateMerchant(
  supabase: TypedSupabaseClient,
  userProviderId: string,
  isPrivyAuth: boolean,
): Promise<MerchantValidationResult> {
  try {
    const merchantQuery = supabase
      .from("merchants")
      .select(`
        merchant_id,
        dynamic_id,
        privy_id,
        wallet_address,
        status,
        default_token_id,
        logo_url,
        stellar_address
      `);

    const { data: merchant, error: merchantError } = isPrivyAuth
      ? await merchantQuery.eq("privy_id", userProviderId).single()
      : await merchantQuery.eq("dynamic_id", userProviderId).single();

    if (merchantError || !merchant) {
      return {
        success: false,
        error: "Merchant not found",
      };
    }

    // Check merchant status
    if (merchant.status === MerchantStatus.PIN_BLOCKED) {
      return {
        success: false,
        error: "Account blocked due to PIN security violations",
        code: "PIN_BLOCKED",
      };
    }

    if (merchant.status === MerchantStatus.INACTIVE) {
      return {
        success: false,
        error: "Account is inactive",
        code: "INACTIVE",
      };
    }

    return { success: true, merchant: merchant as MerchantData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get merchant by ID (internal use)
 */
export async function getMerchantById(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<MerchantValidationResult> {
  try {
    const { data: merchant, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("merchant_id", merchantId)
      .single();

    if (error || !merchant) {
      return { success: false, error: "Merchant not found" };
    }

    return { success: true, merchant: merchant as MerchantData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get merchant with status check (allows blocked check override)
 */
export async function getMerchantWithStatusCheck(
  supabase: TypedSupabaseClient,
  userProviderId: string,
  isPrivyAuth: boolean,
  checkBlocked = true,
): Promise<{ merchant: MerchantData | null; error?: string; code?: string }> {
  const merchantQuery = supabase
    .from("merchants")
    .select("merchant_id, status");

  const { data: merchant, error: merchantError } = isPrivyAuth
    ? await merchantQuery.eq("privy_id", userProviderId).single()
    : await merchantQuery.eq("dynamic_id", userProviderId).single();

  if (merchantError || !merchant) {
    return { merchant: null, error: "Merchant not found" };
  }

  if (checkBlocked) {
    if (merchant.status === MerchantStatus.PIN_BLOCKED) {
      return {
        merchant: null,
        error: "Account blocked due to PIN security violations",
        code: "PIN_BLOCKED",
      };
    }
    if (merchant.status === MerchantStatus.INACTIVE) {
      return {
        merchant: null,
        error: "Account is inactive",
        code: "INACTIVE",
      };
    }
  }

  return { merchant: merchant as MerchantData };
}

/**
 * Resolve preferred token (user's choice or merchant's default)
 */
export async function resolvePreferredToken(
  supabase: TypedSupabaseClient,
  merchantDefaultTokenId: string,
  userPreferredTokenId?: string,
): Promise<{ success: boolean; token?: TokenData; error?: string }> {
  try {
    const tokenIdToUse = userPreferredTokenId || merchantDefaultTokenId;

    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("*")
      .eq("token_id", tokenIdToUse)
      .single();

    if (tokenError || !token) {
      return {
        success: false,
        error: userPreferredTokenId
          ? `Invalid preferred_token_id: Token not found`
          : `Merchant's default token not found: ${merchantDefaultTokenId}`,
      };
    }

    return { success: true, token: token as TokenData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Token resolution failed",
    };
  }
}

/**
 * Get destination address based on token type
 */
export function getDestinationAddress(
  merchant: MerchantData,
): string | null {
  if (merchant.default_token_id === "USDC_XLM") {
    return merchant.stellar_address || null;
  }
  return merchant.wallet_address || null;
}

// ============================================================================
// PIN Management Functions
// ============================================================================

/**
 * Get merchant PIN data from database
 */
async function getMerchantPinData(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<MerchantPinData> {
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "merchant_id, pin_code_hash, pin_code_attempts, status, pin_code_blocked_at",
    )
    .eq("merchant_id", merchantId)
    .single();

  if (error) throw error;
  return data as MerchantPinData;
}

/**
 * Reset PIN attempt counter
 */
async function resetPinAttempts(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<void> {
  await supabase
    .from("merchants")
    .update({
      pin_code_attempts: 0,
      pin_code_last_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);
}

/**
 * Increment PIN attempt counter
 */
async function incrementPinAttempts(
  supabase: TypedSupabaseClient,
  merchantId: string,
  attempts: number,
): Promise<void> {
  await supabase
    .from("merchants")
    .update({
      pin_code_attempts: attempts,
      pin_code_last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);
}

/**
 * Block merchant due to PIN violations
 */
async function blockMerchant(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<void> {
  await supabase
    .from("merchants")
    .update({
      status: MerchantStatus.PIN_BLOCKED,
      pin_code_blocked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);
}

/**
 * Validate PIN code with attempt tracking and blocking logic
 */
export async function validatePinCode(
  supabase: TypedSupabaseClient,
  merchantId: string,
  pinCode: string,
  _ipAddress?: string,
  _userAgent?: string,
): Promise<PinValidationResult> {
  try {
    const merchant = await getMerchantPinData(supabase, merchantId);

    if (!merchant.pin_code_hash) {
      return {
        success: true,
        attempts_remaining: 0,
        is_blocked: false,
        message: "No PIN set",
      };
    }

    // Check if merchant is already blocked
    if (merchant.status === MerchantStatus.PIN_BLOCKED) {
      return {
        success: false,
        attempts_remaining: 0,
        is_blocked: true,
        message: "Account blocked due to PIN violations",
      };
    }

    // Verify PIN
    const isValid = await verifyPinCode(pinCode, merchant.pin_code_hash);

    if (isValid) {
      // Reset attempts on success
      await resetPinAttempts(supabase, merchantId);

      return {
        success: true,
        attempts_remaining: CONSTANTS.PIN.MAX_ATTEMPTS,
        is_blocked: false,
        message: "PIN validated",
      };
    } else {
      // Increment attempts
      const newAttempts = merchant.pin_code_attempts + 1;
      await incrementPinAttempts(supabase, merchantId, newAttempts);

      if (newAttempts >= CONSTANTS.PIN.MAX_ATTEMPTS) {
        // Block merchant
        await blockMerchant(supabase, merchantId);

        return {
          success: false,
          attempts_remaining: 0,
          is_blocked: true,
          message: "Account blocked due to multiple failed PIN attempts",
        };
      }

      return {
        success: false,
        attempts_remaining: CONSTANTS.PIN.MAX_ATTEMPTS - newAttempts,
        is_blocked: false,
        message: `${CONSTANTS.PIN.MAX_ATTEMPTS - newAttempts} attempts remaining`,
      };
    }
  } catch (error) {
    console.error("PIN validation error:", error);
    return {
      success: false,
      attempts_remaining: 0,
      is_blocked: false,
      message: "PIN validation failed",
    };
  }
}

/**
 * Set PIN code for merchant
 */
export async function setMerchantPin(
  supabase: TypedSupabaseClient,
  merchantId: string,
  pinCode: string,
  _ipAddress?: string,
  _userAgent?: string,
): Promise<PinManagementResult> {
  try {
    // Validate PIN code input
    const validation = validatePinCodeInput(pinCode);
    if (!validation.valid) {
      return { success: false, message: validation.error! };
    }

    // Check if PIN is already set
    const merchant = await getMerchantPinData(supabase, merchantId);
    if (merchant.pin_code_hash) {
      return {
        success: false,
        message: "PIN code is already set. Use update endpoint to change it.",
      };
    }

    // Hash and store PIN code
    const hashedPin = await hashPinCode(pinCode);

    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        pin_code_hash: hashedPin,
        pin_code_attempts: 0,
        pin_code_blocked_at: null,
        pin_code_last_attempt_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    return { success: true, message: "PIN code set successfully" };
  } catch (error) {
    console.error("Set PIN error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update PIN code for merchant
 */
export async function updateMerchantPin(
  supabase: TypedSupabaseClient,
  merchantId: string,
  currentPin: string,
  newPin: string,
  _ipAddress?: string,
  _userAgent?: string,
): Promise<PinManagementResult> {
  try {
    // Validate both PIN codes
    const currentValidation = validatePinCodeInput(currentPin);
    if (!currentValidation.valid) {
      return {
        success: false,
        message: `Current PIN: ${currentValidation.error}`,
      };
    }

    const newValidation = validatePinCodeInput(newPin);
    if (!newValidation.valid) {
      return { success: false, message: `New PIN: ${newValidation.error}` };
    }

    // Get merchant data
    const merchant = await getMerchantPinData(supabase, merchantId);

    // Check if PIN is set
    if (!merchant.pin_code_hash) {
      return {
        success: false,
        message: "No PIN code is set. Use set endpoint to create one.",
      };
    }

    // Verify current PIN
    const isCurrentPinValid = await verifyPinCode(
      currentPin,
      merchant.pin_code_hash,
    );
    if (!isCurrentPinValid) {
      return { success: false, message: "Current PIN code is incorrect" };
    }

    // Hash new PIN and update
    const hashedNewPin = await hashPinCode(newPin);

    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        pin_code_hash: hashedNewPin,
        pin_code_attempts: 0,
        pin_code_blocked_at: null,
        pin_code_last_attempt_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    return { success: true, message: "PIN code updated successfully" };
  } catch (error) {
    console.error("Update PIN error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Revoke PIN code for merchant
 */
export async function revokeMerchantPin(
  supabase: TypedSupabaseClient,
  merchantId: string,
  pinCode: string,
  _ipAddress?: string,
  _userAgent?: string,
): Promise<PinManagementResult> {
  try {
    // Validate PIN code input
    const validation = validatePinCodeInput(pinCode);
    if (!validation.valid) {
      return { success: false, message: validation.error! };
    }

    // Get merchant data
    const merchant = await getMerchantPinData(supabase, merchantId);

    // Check if PIN is set
    if (!merchant.pin_code_hash) {
      return { success: false, message: "No PIN code is set" };
    }

    // Verify PIN before revoking
    const isPinValid = await verifyPinCode(pinCode, merchant.pin_code_hash);
    if (!isPinValid) {
      return { success: false, message: "PIN code is incorrect" };
    }

    // Remove PIN code
    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        pin_code_hash: null,
        pin_code_attempts: 0,
        pin_code_blocked_at: null,
        pin_code_last_attempt_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    return { success: true, message: "PIN code revoked successfully" };
  } catch (error) {
    console.error("Revoke PIN error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Require PIN validation middleware helper
 */
export async function requirePinValidation(options: {
  supabase: TypedSupabaseClient;
  merchantId: string;
  pinCode: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  success: boolean;
  error?: string;
  result?: PinValidationResult;
}> {
  const { supabase, merchantId, pinCode, ipAddress, userAgent } = options;

  // Validate PIN code input
  const validation = validatePinCodeInput(pinCode);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Check if merchant has PIN set
  const merchant = await getMerchantPinData(supabase, merchantId);
  if (!merchant.pin_code_hash) {
    return { success: true }; // No PIN required
  }

  // Validate PIN code
  const result = await validatePinCode(
    supabase,
    merchantId,
    pinCode,
    ipAddress,
    userAgent,
  );

  if (result.success) {
    return { success: true, result };
  } else {
    return { success: false, error: result.message, result };
  }
}
