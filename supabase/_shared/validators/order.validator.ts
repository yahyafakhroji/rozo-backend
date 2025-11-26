/**
 * Order Validators
 * Validation functions for order-related operations
 */

import type { ValidationResult } from "../types/api.types.ts";
import type { CreateOrderRequest, CreateDepositRequest } from "../types/common.types.ts";
import { validateRequiredString, validatePositiveAmount } from "./common.validator.ts";

/**
 * Validate create order request
 */
export function validateCreateOrderRequest(
  body: unknown,
): ValidationResult & { data?: CreateOrderRequest } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body is required" };
  }

  const request = body as Record<string, unknown>;

  // Validate display_currency
  const currencyValidation = validateRequiredString(
    request.display_currency,
    "display_currency",
  );
  if (!currencyValidation.success) {
    return currencyValidation;
  }

  // Validate display_amount
  const amountValidation = validatePositiveAmount(
    request.display_amount,
    "display_amount",
  );
  if (!amountValidation.success) {
    return amountValidation;
  }

  return {
    success: true,
    data: {
      display_currency: request.display_currency as string,
      display_amount: request.display_amount as number,
      description: request.description as string | undefined,
      redirect_uri: request.redirect_uri as string | undefined,
      preferred_token_id: request.preferred_token_id as string | undefined,
    },
  };
}

/**
 * Validate create deposit request
 */
export function validateCreateDepositRequest(
  body: unknown,
): ValidationResult & { data?: CreateDepositRequest } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body is required" };
  }

  const request = body as Record<string, unknown>;

  // Validate display_currency
  const currencyValidation = validateRequiredString(
    request.display_currency,
    "display_currency",
  );
  if (!currencyValidation.success) {
    return currencyValidation;
  }

  // Validate display_amount
  const amountValidation = validatePositiveAmount(
    request.display_amount,
    "display_amount",
  );
  if (!amountValidation.success) {
    return amountValidation;
  }

  return {
    success: true,
    data: {
      display_currency: request.display_currency as string,
      display_amount: request.display_amount as number,
      redirect_uri: request.redirect_uri as string | undefined,
    },
  };
}

/**
 * Validate withdrawal request
 */
export function validateWithdrawalRequest(
  body: unknown,
): ValidationResult & {
  data?: { recipient: string; amount: number; currency: string };
} {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body is required" };
  }

  const request = body as Record<string, unknown>;

  // Validate recipient
  const recipientValidation = validateRequiredString(
    request.recipient,
    "recipient",
  );
  if (!recipientValidation.success) {
    return recipientValidation;
  }

  // Validate amount
  const amountValidation = validatePositiveAmount(request.amount, "amount");
  if (!amountValidation.success) {
    return amountValidation;
  }

  // Validate currency
  const currencyValidation = validateRequiredString(
    request.currency,
    "currency",
  );
  if (!currencyValidation.success) {
    return currencyValidation;
  }

  return {
    success: true,
    data: {
      recipient: request.recipient as string,
      amount: request.amount as number,
      currency: request.currency as string,
    },
  };
}

/**
 * Validate device registration request
 */
export function validateDeviceRegistrationRequest(
  body: unknown,
): ValidationResult & {
  data?: { device_id: string; fcm_token: string; platform: "ios" | "android" };
} {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body is required" };
  }

  const request = body as Record<string, unknown>;

  // Validate device_id
  const deviceIdValidation = validateRequiredString(
    request.device_id,
    "device_id",
  );
  if (!deviceIdValidation.success) {
    return deviceIdValidation;
  }

  // Validate fcm_token
  const fcmTokenValidation = validateRequiredString(
    request.fcm_token,
    "fcm_token",
  );
  if (!fcmTokenValidation.success) {
    return fcmTokenValidation;
  }

  // Validate platform
  if (!request.platform || typeof request.platform !== "string") {
    return { success: false, error: "Platform is required" };
  }

  if (!["ios", "android"].includes(request.platform)) {
    return {
      success: false,
      error: "Invalid platform. Must be ios or android",
    };
  }

  return {
    success: true,
    data: {
      device_id: request.device_id as string,
      fcm_token: request.fcm_token as string,
      platform: request.platform as "ios" | "android",
    },
  };
}

/**
 * Validate transaction request for wallets
 */
export function validateTransactionRequest(
  body: unknown,
): ValidationResult & {
  data?: {
    recipientAddress: string;
    amount: number;
    signature: string;
    requestId?: string;
  };
} {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body must be an object" };
  }

  const request = body as Record<string, unknown>;

  // Validate signature
  if (!request.signature || typeof request.signature !== "string") {
    return { success: false, error: "signature is required and must be a string" };
  }

  // Validate recipientAddress
  if (
    !request.recipientAddress ||
    typeof request.recipientAddress !== "string"
  ) {
    return {
      success: false,
      error: "recipientAddress is required and must be a string",
    };
  }

  // Validate Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(request.recipientAddress)) {
    return {
      success: false,
      error: "recipientAddress must be a valid Ethereum address",
    };
  }

  // Validate amount
  if (
    !request.amount ||
    typeof request.amount !== "number" ||
    request.amount <= 0
  ) {
    return {
      success: false,
      error: "amount is required and must be a positive number",
    };
  }

  return {
    success: true,
    data: {
      recipientAddress: request.recipientAddress as string,
      amount: request.amount as number,
      signature: request.signature as string,
      requestId: request.requestId as string | undefined,
    },
  };
}

/**
 * Validate Stellar transfer request
 */
export function validateStellarTransferRequest(
  body: unknown,
): ValidationResult & {
  data?: { destinationAddress: string; amount: string };
} {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body is required" };
  }

  const request = body as Record<string, unknown>;

  // Validate destinationAddress
  if (
    !request.destinationAddress ||
    typeof request.destinationAddress !== "string"
  ) {
    return {
      success: false,
      error: "destinationAddress is required and must be a string",
    };
  }

  // Validate Stellar address format
  if (!/^G[A-Z0-9]{55}$/.test(request.destinationAddress)) {
    return {
      success: false,
      error:
        "Invalid destination address format. Must be a valid Stellar public key (G...)",
    };
  }

  // Validate amount
  if (!request.amount) {
    return { success: false, error: "amount is required" };
  }

  const amountStr = typeof request.amount === "number"
    ? request.amount.toString()
    : (request.amount as string);

  return {
    success: true,
    data: {
      destinationAddress: request.destinationAddress as string,
      amount: amountStr,
    },
  };
}
