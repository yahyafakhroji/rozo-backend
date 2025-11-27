/**
 * Wallets Function
 * Handles wallet operations including EVM and Stellar transfers
 * Refactored to use new middleware and type-safe utilities
 */

import { Context, Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { PrivyClient } from "@privy-io/node";
import { Buffer } from "node:buffer";
import { encodeFunctionData, erc20Abi } from "viem";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

// Middleware
import {
  privyAuthMiddleware,
  errorMiddleware,
  merchantResolverMiddleware,
  getMerchantFromContext,
} from "../../_shared/middleware/index.ts";

// Services
import { requirePinValidation } from "../../_shared/services/merchant.service.ts";
import {
  logWalletTransfer,
  AuditAction,
} from "../../_shared/services/audit.service.ts";

// Schemas
import {
  TransactionRequestSchema,
  StellarTransferSchema,
  safeParseBody,
} from "../../_shared/schemas/index.ts";

// Utils
import { extractPinFromHeaders, extractClientInfo } from "../../_shared/utils/helpers.ts";
import { extractBearerToken } from "../../_shared/utils/jwt.utils.ts";
import { rateLimitByMerchant, RATE_LIMITS } from "../../_shared/utils/rateLimit.utils.ts";
import { submitSignedPaymentTx } from "./transfer.ts";
import {
  getStellarErrorMessage as getStellarError,
  isTrustlineAlreadyExists as isTrustlineExists,
  submitSignedTrustlineTx,
} from "./trustline.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { TransactionRequestInput, StellarTransferInput } from "../../_shared/schemas/index.ts";

// Debug utilities
import { walletLogger as logger } from "../../_shared/utils/debug.utils.ts";

const debugLog = (step: string, data?: unknown) => logger.debug(step, data);
const debugError = (step: string, error: unknown) => logger.error(step, error);
const debugSuccess = (step: string, data?: unknown) => logger.success(step, data);

const functionName = "wallets";
const app = new Hono().basePath(`/${functionName}`);

// ============================================================================
// Types
// ============================================================================

interface WalletResponse {
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

interface TransactionConfig {
  recipientAddress: string;
  amountToSend: number;
  decimals: number;
  usdcContractAddress: string;
  chainId: string;
  policyId: string;
  authorizationPrivateKey: string;
}

interface TransactionResult {
  hash: string;
  caip2: string;
  walletId: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TRANSACTION_CONFIG: Omit<
  TransactionConfig,
  "recipientAddress" | "amountToSend"
> = {
  decimals: 6, // USDC has 6 decimals
  usdcContractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  chainId: "0x2105", // 8453
  policyId: Deno.env.get("PRIVY_POLICY_ID") as string,
  authorizationPrivateKey: Deno.env.get("PRIVY_AUTHORIZATION_PRIVATE_KEY") as string,
};

// In-memory cache for tracking recent transactions (prevents duplicates)
const transactionCache = new Map<string, {
  result: TransactionResult;
  timestamp: number;
  walletId: string;
}>();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// Apply Middleware Stack
// ============================================================================

app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", privyAuthMiddleware);
app.use("*", merchantResolverMiddleware);

// ============================================================================
// Utility Functions
// ============================================================================

function generateBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function generateCacheKey(
  walletId: string,
  recipientAddress: string,
  amount: number,
  signature: string,
  requestId?: string,
): string {
  if (requestId) {
    return `req:${requestId}`;
  }
  const transactionData = `${walletId}:${recipientAddress}:${amount}:${signature}`;
  return `txn:${Buffer.from(transactionData).toString("base64")}`;
}

function checkDuplicateTransaction(
  cacheKey: string,
  walletId: string,
): TransactionResult | null {
  const cached = transactionCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL || cached.walletId !== walletId) {
    transactionCache.delete(cacheKey);
    return null;
  }

  debugLog("Found duplicate transaction in cache", {
    cacheKey,
    walletId,
    cachedResult: cached.result,
    age: now - cached.timestamp,
  });

  return cached.result;
}

function cacheTransactionResult(
  cacheKey: string,
  walletId: string,
  result: TransactionResult,
): void {
  transactionCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    walletId,
  });
}

function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of transactionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      transactionCache.delete(key);
    }
  }
}

async function checkIfWalletHasOwner(walletId: string): Promise<WalletResponse> {
  debugLog("Checking wallet owner", { walletId });

  const res = await fetch(`https://api.privy.io/v1/wallets/${walletId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": Deno.env.get("PRIVY_APP_ID") as string,
      Authorization: generateBasicAuthHeader(
        Deno.env.get("PRIVY_APP_ID") as string,
        Deno.env.get("PRIVY_APP_SECRET") as string,
      ),
    },
  });

  if (!res.ok) {
    const errorData = await res.json();
    debugError("Failed to fetch wallet owner", errorData);
    throw new Error(`Failed to fetch wallet owner: ${JSON.stringify(errorData)}`);
  }

  const response = await res.json();
  debugSuccess("Wallet owner retrieved", { ownerId: response.owner_id });
  return response;
}

async function validateTransactionRequest(
  authHeader: string | null,
  walletId: string,
): Promise<{ token: string; walletOwner: WalletResponse }> {
  debugLog("Validating transaction request", { walletId });

  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new Error("Missing or invalid authorization header");
  }

  const walletOwner = await checkIfWalletHasOwner(walletId);
  if (!walletOwner.owner_id) {
    throw new Error("Wallet does not have an owner");
  }

  debugSuccess("Transaction request validated", {
    walletId,
    ownerId: walletOwner.owner_id,
  });

  return { token, walletOwner };
}

async function updateWalletWithPolicy(
  privy: PrivyClient,
  walletId: string,
  token: string,
  signature: string,
  ownerId: string,
  policyId: string,
): Promise<void> {
  debugLog("Updating wallet with policy", { walletId, ownerId, policyId });

  const res = await privy.wallets().update(walletId, {
    authorization_context: {
      user_jwts: [token],
      signatures: [signature],
    },
    owner_id: ownerId,
    policy_ids: [policyId],
  });

  debugSuccess("Wallet updated with policy", res);
}

function encodeTransferData(config: TransactionConfig): string {
  debugLog("Encoding transfer data", {
    recipient: config.recipientAddress,
    amount: config.amountToSend,
    decimals: config.decimals,
  });

  const encodedData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [
      config.recipientAddress as `0x${string}`,
      BigInt(config.amountToSend * 10 ** config.decimals),
    ],
  });

  debugSuccess("Transfer data encoded", { encodedData });
  return encodedData;
}

async function sendTransaction(
  privy: PrivyClient,
  walletId: string,
  token: string,
  signature: string,
  config: TransactionConfig,
  encodedData: string,
): Promise<TransactionResult> {
  debugLog("Sending transaction", {
    walletId,
    contractAddress: config.usdcContractAddress,
  });

  const { hash, caip2 } = await privy.wallets().ethereum().sendTransaction(
    walletId,
    {
      caip2: "eip155:8453",
      sponsor: true,
      authorization_context: {
        user_jwts: [token],
        signatures: [signature],
        authorization_private_keys: [config.authorizationPrivateKey],
      },
      params: {
        transaction: {
          to: config.usdcContractAddress,
          data: encodedData,
          chain_id: config.chainId,
        },
      },
    },
  );

  const result: TransactionResult = { hash, caip2, walletId };
  debugSuccess("Transaction sent", result);

  return result;
}

// ============================================================================
// PIN Validation Helper
// ============================================================================

async function validatePinIfRequired(
  c: Context,
  supabase: TypedSupabaseClient,
  merchantId: string,
  hasPinHash: boolean,
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  if (!hasPinHash) {
    return { success: true };
  }

  const pinCode = extractPinFromHeaders(c.req.raw);

  if (!pinCode) {
    debugError("PIN code required for transaction", { merchantId });
    return {
      success: false,
      error: "PIN code is required for wallet transaction operations",
      statusCode: 400,
    };
  }

  const { ipAddress, userAgent } = extractClientInfo(c.req.raw);

  const pinValidation = await requirePinValidation({
    supabase,
    merchantId,
    pinCode,
    ipAddress,
    userAgent,
  });

  if (!pinValidation.success) {
    debugError("PIN validation failed", {
      merchantId,
      error: pinValidation.error,
      attemptsRemaining: pinValidation.result?.attempts_remaining,
    });
    return {
      success: false,
      error: pinValidation.error || "PIN validation failed",
      statusCode: 401,
    };
  }

  debugSuccess("PIN validation successful", { merchantId });
  return { success: true };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /wallets/:walletId - EVM Transfer (USDC on Base)
 */
app.post("/:walletId", async (c) => {
  const walletId = c.req.param("walletId");
  debugLog("Starting EVM transaction process", { walletId });

  // Check required environment variables
  if (!Deno.env.get("PRIVY_POLICY_ID")) {
    return c.json({ error: "Missing environment variables: PRIVY_POLICY_ID" }, 500);
  }
  if (!Deno.env.get("PRIVY_AUTHORIZATION_PRIVATE_KEY")) {
    return c.json({ error: "Missing environment variables: PRIVY_AUTHORIZATION_PRIVATE_KEY" }, 500);
  }

  // Clean up expired cache entries
  cleanupExpiredCache();

  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Apply rate limiting for wallet transfers
  try {
    rateLimitByMerchant(merchant.merchant_id, "wallet_transfer", RATE_LIMITS.WITHDRAWAL);
  } catch {
    return c.json({
      success: false,
      error: "Too many transfer requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    }, 429);
  }

  // Parse and validate request body using Zod
  const body = await c.req.json();
  const validation = safeParseBody(TransactionRequestSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const transactionRequest: TransactionRequestInput = validation.data;

  // Check for duplicate transaction
  const cacheKey = generateCacheKey(
    walletId,
    transactionRequest.recipientAddress,
    transactionRequest.amount,
    transactionRequest.signature,
    transactionRequest.requestId,
  );

  const duplicateResult = checkDuplicateTransaction(cacheKey, walletId);
  if (duplicateResult) {
    debugLog("Returning cached transaction result", { cacheKey, duplicateResult });
    return c.json({
      success: true,
      transaction: duplicateResult,
      walletId,
      recipientAddress: transactionRequest.recipientAddress,
      amount: transactionRequest.amount,
      cached: true,
    });
  }

  // PIN validation if required
  const pinCheck = await validatePinIfRequired(
    c,
    supabase,
    merchant.merchant_id,
    merchant.has_pin,
  );

  if (!pinCheck.success) {
    return c.json({
      success: false,
      error: pinCheck.error,
      code: "PIN_REQUIRED",
    }, pinCheck.statusCode || 400);
  }

  // Log transfer initiation
  logWalletTransfer(
    supabase,
    merchant.merchant_id,
    AuditAction.WALLET_TRANSFER_INITIATED,
    {
      amount: transactionRequest.amount,
      recipient: transactionRequest.recipientAddress,
    },
  );

  try {
    // Validate wallet ownership
    const authHeader = c.req.header("Authorization");
    const { token, walletOwner } = await validateTransactionRequest(authHeader ?? null, walletId);

    // Initialize Privy client
    const privy = new PrivyClient({
      appId: Deno.env.get("PRIVY_APP_ID")!,
      appSecret: Deno.env.get("PRIVY_APP_SECRET")!,
    });

    // Create transaction config
    const transactionConfig: TransactionConfig = {
      ...DEFAULT_TRANSACTION_CONFIG,
      recipientAddress: transactionRequest.recipientAddress,
      amountToSend: transactionRequest.amount,
    };

    // Update wallet with policy
    await updateWalletWithPolicy(
      privy,
      walletId,
      token,
      transactionRequest.signature,
      walletOwner.owner_id,
      transactionConfig.policyId,
    );

    // Encode and send transaction
    const encodedData = encodeTransferData(transactionConfig);
    const transactionResult = await sendTransaction(
      privy,
      walletId,
      token,
      transactionRequest.signature,
      transactionConfig,
      encodedData,
    );

    // Cache the result
    cacheTransactionResult(cacheKey, walletId, transactionResult);

    // Log successful transfer
    logWalletTransfer(
      supabase,
      merchant.merchant_id,
      AuditAction.WALLET_TRANSFER_COMPLETED,
      {
        amount: transactionRequest.amount,
        recipient: transactionRequest.recipientAddress,
        txHash: transactionResult.hash,
      },
    );

    debugSuccess("Transaction completed successfully", transactionResult);

    return c.json({
      success: true,
      transaction: transactionResult,
      walletId,
      recipientAddress: transactionConfig.recipientAddress,
      amount: transactionConfig.amountToSend,
    });
  } catch (error) {
    debugError("Transaction failed", error);

    // Log failed transfer
    logWalletTransfer(
      supabase,
      merchant.merchant_id,
      AuditAction.WALLET_TRANSFER_FAILED,
      {
        amount: transactionRequest.amount,
        recipient: transactionRequest.recipientAddress,
      },
    );

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to process wallet transaction",
      details: errorMessage,
    }, 500);
  }
});

/**
 * POST /wallets/:walletId/enable-usdc - Enable USDC trustline on Stellar
 */
app.post("/:walletId/enable-usdc", async (c) => {
  const walletId = c.req.param("walletId");
  debugLog("Enable USDC - start", { walletId });

  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // PIN validation if required
  const pinCheck = await validatePinIfRequired(
    c,
    supabase,
    merchant.merchant_id,
    merchant.has_pin,
  );

  if (!pinCheck.success) {
    return c.json({
      success: false,
      error: pinCheck.error,
      code: "PIN_REQUIRED",
    }, pinCheck.statusCode || 400);
  }

  try {
    // Validate wallet ownership
    const authHeader = c.req.header("Authorization");
    const { token, walletOwner } = await validateTransactionRequest(authHeader ?? null, walletId);

    if (!walletOwner.address) {
      debugError("Enable USDC - wallet missing address", { walletId });
      return c.json({
        success: false,
        error: "Wallet not found or missing address",
      }, 404);
    }

    debugSuccess("Enable USDC - wallet verified", {
      ownerId: walletOwner.owner_id,
      address: walletOwner.address,
    });

    // Submit trustline to Stellar network
    const submission = await submitSignedTrustlineTx({
      token,
      walletId,
      signerPublicKey: walletOwner.address,
    });

    if (submission.successful) {
      debugSuccess("Enable USDC - trustline submitted", {
        hash: submission.hash,
        ledger: submission.ledger,
      });
      return c.json({ success: true, result: submission }, 200);
    }

    if (submission.alreadyExists || isTrustlineExists(submission.raw)) {
      debugSuccess("Enable USDC - trustline already exists");
      return c.json(
        { success: true, already_exists: true, result: submission },
        200,
      );
    }

    debugError("Enable USDC - submission failed", submission.raw);
    return c.json(
      { success: false, error: getStellarError(submission.raw) },
      400,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    debugError("Enable USDC - unhandled error", e);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * POST /wallets/:walletId/stellar-transfer - Transfer USDC on Stellar
 */
app.post("/:walletId/stellar-transfer", async (c) => {
  const walletId = c.req.param("walletId");
  debugLog("Stellar Transfer - start", { walletId });

  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  // Apply rate limiting for wallet transfers
  try {
    rateLimitByMerchant(merchant.merchant_id, "stellar_transfer", RATE_LIMITS.WITHDRAWAL);
  } catch {
    return c.json({
      success: false,
      error: "Too many transfer requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    }, 429);
  }

  // Parse and validate request body using Zod
  const body = await c.req.json();
  const validation = safeParseBody(StellarTransferSchema, body);

  if (!validation.success) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const transferRequest: StellarTransferInput = validation.data;

  // PIN validation if required
  const pinCheck = await validatePinIfRequired(
    c,
    supabase,
    merchant.merchant_id,
    merchant.has_pin,
  );

  if (!pinCheck.success) {
    return c.json({
      success: false,
      error: pinCheck.error,
      code: "PIN_REQUIRED",
    }, pinCheck.statusCode || 400);
  }

  // Log transfer initiation
  logWalletTransfer(
    supabase,
    merchant.merchant_id,
    AuditAction.WALLET_TRANSFER_INITIATED,
    {
      amount: parseFloat(transferRequest.amount),
      recipient: transferRequest.destinationAddress,
    },
  );

  try {
    // Validate wallet ownership
    const authHeader = c.req.header("Authorization");
    const { token, walletOwner } = await validateTransactionRequest(authHeader ?? null, walletId);

    if (!walletOwner.address) {
      debugError("Stellar Transfer - wallet missing address", { walletId });
      return c.json({
        success: false,
        error: "Wallet not found or missing address",
      }, 404);
    }

    debugSuccess("Stellar Transfer - wallet verified", {
      ownerId: walletOwner.owner_id,
      address: walletOwner.address,
    });

    // Submit payment to Stellar network
    const submission = await submitSignedPaymentTx({
      token,
      walletId,
      signerPublicKey: walletOwner.address,
      destinationAddress: transferRequest.destinationAddress,
      amount: transferRequest.amount,
    });

    if (submission.successful) {
      debugSuccess("Stellar Transfer - payment submitted", {
        hash: submission.hash,
        ledger: submission.ledger,
      });

      // Log successful transfer
      logWalletTransfer(
        supabase,
        merchant.merchant_id,
        AuditAction.WALLET_TRANSFER_COMPLETED,
        {
          amount: parseFloat(transferRequest.amount),
          recipient: transferRequest.destinationAddress,
          txHash: submission.hash,
        },
      );

      return c.json({ success: true, result: submission }, 200);
    }

    debugError("Stellar Transfer - submission failed", submission.raw);

    // Log failed transfer
    logWalletTransfer(
      supabase,
      merchant.merchant_id,
      AuditAction.WALLET_TRANSFER_FAILED,
      {
        amount: parseFloat(transferRequest.amount),
        recipient: transferRequest.destinationAddress,
      },
    );

    return c.json(
      { success: false, error: submission.errorMessage || getStellarError(submission.raw) },
      400,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    debugError("Stellar Transfer - unhandled error", e);

    // Log failed transfer
    logWalletTransfer(
      supabase,
      merchant.merchant_id,
      AuditAction.WALLET_TRANSFER_FAILED,
      {
        amount: parseFloat(transferRequest.amount),
        recipient: transferRequest.destinationAddress,
      },
    );

    return c.json({ success: false, error: message }, 500);
  }
});

// Export for Deno
Deno.serve(app.fetch);
