/**
 * Wallets Function
 * Handles wallet management (CRUD operations) and chain information
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig } from "../../_shared/config/index.ts";

// Middleware
import {
  errorMiddleware,
  getMerchantFromContext,
  merchantResolverMiddleware,
  notFoundHandler,
  privyAuthMiddleware,
} from "../../_shared/middleware/index.ts";

// Services
import {
  addMerchantWallet,
  deleteMerchantWallet,
  getActiveChains,
  getMerchantWallets,
  getWalletById,
  setWalletAsPrimary,
  syncPrivyWallet,
  updateMerchantWallet,
} from "../../_shared/services/wallet.service.ts";

// Types
import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";
import type { ApiResponse } from "../../_shared/types/api.types.ts";
import type {
  ChainData,
  TokenInfo,
  WalletBalanceData,
  WalletData,
} from "./types.ts";

// Privy utilities
import {
  getWalletBalance,
  mapChainIdToPrivyChain,
  mapTokenToPrivyAsset,
  type PrivyAsset,
  type PrivyChain,
} from "../../_shared/utils/privy.utils.ts";

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath("/wallets");

// Global middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", privyAuthMiddleware);

// ============================================================================
// Chain Routes
// ============================================================================

/**
 * GET /wallets/chains - Get available chains
 */
app.get("/chains", async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;

  const result = await getActiveChains(supabase);

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to fetch chains",
      code: "DATABASE_ERROR",
    }, 500);
  }

  return c.json<ApiResponse<ChainData[]>>({
    success: true,
    data: result.chains as ChainData[],
  });
});

// ============================================================================
// Wallet Management Routes
// ============================================================================

/**
 * GET /wallets - Get all merchant wallets
 */
app.get("/", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);

  const result = await getMerchantWallets(supabase, merchant.merchant_id);

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to fetch wallets",
      code: "DATABASE_ERROR",
    }, 500);
  }

  return c.json<ApiResponse<WalletData[]>>({
    success: true,
    data: result.wallets as WalletData[],
  });
});

/**
 * GET /wallets/:walletId/balance - Get wallet balance
 * Query params:
 *   - token_id (optional): Token ID from tokens table
 *   - asset (optional): Direct asset name (usdc, eth, etc.)
 */
app.get("/:walletId/balance", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletId = c.req.param("walletId");

  const tokenId = c.req.query("token_id");
  const assetParam = c.req.query("asset");

  // Verify wallet belongs to merchant and get external_wallet_id
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("wallet_id, chain_id, address, external_wallet_id")
    .eq("wallet_id", walletId)
    .eq("merchant_id", merchant.merchant_id)
    .single();

  if (walletError || !wallet) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Wallet not found",
      code: "NOT_FOUND",
    }, 404);
  }

  const externalWalletId = wallet.external_wallet_id;

  if (!externalWalletId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Wallet balance not available (no external wallet linked)",
      code: "WALLET_NOT_LINKED",
    }, 400);
  }

  // Resolve asset and chain
  let asset: string;
  let chain: PrivyChain | null;
  let tokenInfo: TokenInfo | null = null;

  if (tokenId) {
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("token_name, token_address, chain_id")
      .eq("token_id", tokenId)
      .eq("is_active", true)
      .single();

    if (tokenError || !token) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: "Token not found",
        code: "NOT_FOUND",
      }, 404);
    }

    if (token.chain_id !== wallet.chain_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: `Token chain (${token.chain_id}) doesn't match wallet chain (${wallet.chain_id})`,
        code: "CHAIN_MISMATCH",
      }, 400);
    }

    asset = mapTokenToPrivyAsset(token.token_name);
    chain = mapChainIdToPrivyChain(wallet.chain_id);
    tokenInfo = { token_name: token.token_name, token_address: token.token_address };
  } else if (assetParam) {
    asset = assetParam;
    chain = mapChainIdToPrivyChain(wallet.chain_id);
  } else {
    asset = "usdc";
    chain = mapChainIdToPrivyChain(wallet.chain_id);
  }

  if (!chain) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Unsupported chain for balance lookup",
      code: "UNSUPPORTED_CHAIN",
    }, 400);
  }

  const balanceResult = await getWalletBalance({
    walletId: externalWalletId,
    asset: asset as PrivyAsset,
    chain: chain,
    includeCurrency: "usd",
  });

  if (!balanceResult.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: balanceResult.error || "Failed to fetch balance",
      code: "BALANCE_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<WalletBalanceData>>({
    success: true,
    data: {
      wallet_id: walletId,
      address: wallet.address,
      chain_id: wallet.chain_id,
      token: tokenInfo,
      asset,
      balances: balanceResult.balances || [],
    },
  });
});

/**
 * GET /wallets/:walletId - Get wallet by ID
 */
app.get("/:walletId", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletId = c.req.param("walletId");

  if (walletId === "chains") {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "Invalid wallet ID",
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await getWalletById(supabase, walletId, merchant.merchant_id);

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Wallet not found",
      code: "NOT_FOUND",
    }, 404);
  }

  return c.json<ApiResponse<WalletData>>({
    success: true,
    data: result.wallet as WalletData,
  });
});

/**
 * POST /wallets - Add a new wallet
 */
app.post("/", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const body = await c.req.json().catch(() => ({}));

  if (!body.chain_id || !body.address) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: "chain_id and address are required",
      code: "VALIDATION_ERROR",
    }, 400);
  }

  const result = await addMerchantWallet(supabase, merchant.merchant_id, {
    chain_id: body.chain_id,
    address: body.address,
    label: body.label,
    source: body.source || "manual",
    is_primary: body.is_primary,
  });

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to add wallet",
      code: "DATABASE_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<WalletData>>({
    success: true,
    data: result.wallet as WalletData,
    message: "Wallet added successfully",
  }, 201);
});

/**
 * POST /wallets/sync - Sync Privy wallet to wallets table
 */
app.post("/sync", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletAddress = c.get("walletAddress") as string;

  const body = await c.req.json().catch(() => ({}));
  const chainId = body.chain_id || "8453"; // Default to Base

  const result = await syncPrivyWallet(
    supabase,
    merchant.merchant_id,
    walletAddress,
    chainId,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to sync wallet",
      code: "SYNC_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<WalletData>>({
    success: true,
    data: result.wallet as WalletData,
    message: "Privy wallet synced successfully",
  });
});

/**
 * PUT /wallets/:walletId - Update a wallet
 */
app.put("/:walletId", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletId = c.req.param("walletId");
  const body = await c.req.json().catch(() => ({}));

  const result = await updateMerchantWallet(
    supabase,
    walletId,
    merchant.merchant_id,
    {
      label: body.label,
      is_primary: body.is_primary,
    },
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to update wallet",
      code: "DATABASE_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<WalletData>>({
    success: true,
    data: result.wallet as WalletData,
  });
});

/**
 * PUT /wallets/:walletId/primary - Set wallet as primary
 */
app.put("/:walletId/primary", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletId = c.req.param("walletId");

  const result = await setWalletAsPrimary(
    supabase,
    walletId,
    merchant.merchant_id,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to set primary wallet",
      code: "DATABASE_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<WalletData>>({
    success: true,
    data: result.wallet as WalletData,
    message: "Wallet set as primary successfully",
  });
});

/**
 * DELETE /wallets/:walletId - Delete a wallet
 */
app.delete("/:walletId", merchantResolverMiddleware, async (c) => {
  const supabase = c.get("supabase") as TypedSupabaseClient;
  const merchant = getMerchantFromContext(c);
  const walletId = c.req.param("walletId");

  const result = await deleteMerchantWallet(
    supabase,
    walletId,
    merchant.merchant_id,
  );

  if (!result.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: result.error || "Failed to delete wallet",
      code: "DATABASE_ERROR",
    }, 400);
  }

  return c.json<ApiResponse<null>>({
    success: true,
    message: "Wallet deleted successfully",
  });
});

// Not found handler
app.notFound(notFoundHandler);

// Export
Deno.serve(app.fetch);
