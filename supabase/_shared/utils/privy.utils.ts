/**
 * Privy Utilities
 * Centralized Privy API client and wallet operations
 */

import { PrivyClient } from "npm:@privy-io/node";
import { Buffer } from "node:buffer";

// ============================================================================
// Types
// ============================================================================

export interface PrivyWallet {
  id: string;
  address: string;
  chain_type: string;
  owner_id: string;
  created_at: number;
  policy_ids?: string[];
  additional_signers?: string[];
  exported_at?: string | null;
  imported_at?: string | null;
}

export interface PrivyBalance {
  chain: string;
  asset: string;
  raw_value: string;
  raw_value_decimals: number;
  display_values: {
    [key: string]: string; // e.g., { usdc: "1.00", usd: "1.00" }
  };
}

export interface CreateWalletOptions {
  chainType: "ethereum" | "stellar" | "solana";
  ownerUserId?: string; // Privy user ID to link wallet to user
  policyIds?: string[];
}

export interface CreateWalletResult {
  success: boolean;
  wallet?: PrivyWallet;
  error?: string;
}

export interface GetWalletResult {
  success: boolean;
  wallet?: PrivyWallet;
  error?: string;
}

export interface GetBalanceResult {
  success: boolean;
  balances?: PrivyBalance[];
  error?: string;
}

export interface ListWalletsResult {
  success: boolean;
  wallets?: PrivyWallet[];
  error?: string;
}

// Supported Privy assets
export type PrivyAsset = "usdc" | "eth" | "sol" | "usdt" | "pol";

// Supported Privy chains
export type PrivyChain =
  | "base"
  | "ethereum"
  | "arbitrum"
  | "polygon"
  | "solana"
  | "optimism"
  | "linea"
  | "zksync-era"
  | "base-sepolia"
  | "ethereum-sepolia";

export interface GetBalanceOptions {
  walletId: string;
  asset: PrivyAsset;
  chain: PrivyChain;
  includeCurrency?: "usd";
}

// ============================================================================
// Singleton Privy Client
// ============================================================================

let privyClient: PrivyClient | null = null;

/**
 * Get or create singleton Privy client
 */
export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = Deno.env.get("PRIVY_APP_ID");
    const appSecret = Deno.env.get("PRIVY_APP_SECRET");

    if (!appId || !appSecret) {
      throw new Error("Missing PRIVY_APP_ID or PRIVY_APP_SECRET environment variables");
    }

    privyClient = new PrivyClient({
      appId,
      appSecret,
    });
  }
  return privyClient;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate Basic Auth header for REST API calls
 */
function getBasicAuthHeader(): string {
  const appId = Deno.env.get("PRIVY_APP_ID")!;
  const appSecret = Deno.env.get("PRIVY_APP_SECRET")!;
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;
}

/**
 * Get standard API headers for Privy REST API
 */
function getApiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "privy-app-id": Deno.env.get("PRIVY_APP_ID")!,
    Authorization: getBasicAuthHeader(),
  };
}

/**
 * Map chain_id to Privy chain name
 */
export function mapChainIdToPrivyChain(chainId: string): PrivyChain | null {
  const chainMap: Record<string, PrivyChain> = {
    // Mainnets
    "1": "ethereum",
    "8453": "base",
    "42161": "arbitrum",
    "137": "polygon",
    "10": "optimism",
    "59144": "linea",
    "324": "zksync-era",
    // Testnets
    "84532": "base-sepolia",
    "11155111": "ethereum-sepolia",
  };
  return chainMap[chainId] || null;
}

/**
 * Map token name to Privy asset name
 */
export function mapTokenToPrivyAsset(tokenName: string): PrivyAsset {
  const assetMap: Record<string, PrivyAsset> = {
    USDC: "usdc",
    USDT: "usdt",
    ETH: "eth",
    MATIC: "pol",
    POL: "pol",
    SOL: "sol",
  };
  return assetMap[tokenName.toUpperCase()] || ("usdc" as PrivyAsset);
}

// ============================================================================
// Wallet Operations
// ============================================================================

/**
 * Create a new wallet via Privy API
 */
export async function createWallet(
  options: CreateWalletOptions
): Promise<CreateWalletResult> {
  try {
    const body: Record<string, unknown> = {
      chain_type: options.chainType,
    };

    if (options.ownerUserId) {
      body.owner = { user_id: options.ownerUserId };
    }

    if (options.policyIds?.length) {
      body.policy_ids = options.policyIds;
    }

    const res = await fetch("https://api.privy.io/v1/wallets", {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.message || `Failed to create wallet: ${res.status}`,
      };
    }

    const wallet = await res.json();
    return { success: true, wallet };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Wallet creation failed",
    };
  }
}

/**
 * Get wallet by ID
 */
export async function getWallet(walletId: string): Promise<GetWalletResult> {
  try {
    const res = await fetch(`https://api.privy.io/v1/wallets/${walletId}`, {
      method: "GET",
      headers: getApiHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.message || "Wallet not found",
      };
    }

    const wallet = await res.json();
    return { success: true, wallet };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get wallet",
    };
  }
}

/**
 * Get wallet balance via Privy API
 */
export async function getWalletBalance(
  options: GetBalanceOptions
): Promise<GetBalanceResult> {
  try {
    const params = new URLSearchParams({
      asset: options.asset,
      chain: options.chain,
    });

    if (options.includeCurrency) {
      params.append("include_currency", options.includeCurrency);
    }

    const res = await fetch(
      `https://api.privy.io/v1/wallets/${options.walletId}/balance?${params}`,
      {
        method: "GET",
        headers: getApiHeaders(),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.message || "Failed to get balance",
      };
    }

    const data = await res.json();
    return { success: true, balances: data.balances };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance",
    };
  }
}

/**
 * List wallets for a user
 */
export async function listUserWallets(
  userId: string,
  chainType?: string
): Promise<ListWalletsResult> {
  try {
    const params = new URLSearchParams({ user_id: userId });
    if (chainType) {
      params.append("chain_type", chainType);
    }

    const res = await fetch(`https://api.privy.io/v1/wallets?${params}`, {
      method: "GET",
      headers: getApiHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.message || "Failed to list wallets",
      };
    }

    const data = await res.json();
    return { success: true, wallets: data.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list wallets",
    };
  }
}

/**
 * Get Privy user by ID
 */
export async function getPrivyUser(
  privyUserId: string
): Promise<{ success: boolean; user?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`https://api.privy.io/v1/users/${privyUserId}`, {
      method: "GET",
      headers: getApiHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.message || "User not found",
      };
    }

    const user = await res.json();
    return { success: true, user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get user",
    };
  }
}

// ============================================================================
// Re-export PrivyClient for SDK usage
// ============================================================================

export { PrivyClient };
