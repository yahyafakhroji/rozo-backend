/**
 * JWT Utilities
 * JWT verification and extraction utilities for Dynamic and Privy
 */

import jwt, { JwtPayload } from "npm:jsonwebtoken";
import { JwksClient } from "npm:jwks-rsa";
import { PrivyClient } from "npm:@privy-io/server-auth";
import type {
  AuthResult,
  DecodedJWT,
  DualAuthResult,
  VerifiedCredential,
} from "../types/auth.types.ts";

/**
 * Get embedded wallet address from JWT credentials
 */
function getEmbeddedWalletAddress(decodedJWT: DecodedJWT): string | null {
  const embeddedWallet = decodedJWT.verified_credentials?.find(
    (credential: VerifiedCredential) =>
      credential.wallet_provider === "smartContractWallet",
  );
  return embeddedWallet?.address || null;
}

/**
 * Verify Dynamic JWT token
 */
export async function verifyDynamicJWT(
  token: string,
  dynamicEnvId: string,
  allowAdditionalAuth = false,
): Promise<AuthResult> {
  try {
    const jwksUrl =
      `https://app.dynamic.xyz/api/v0/sdk/${dynamicEnvId}/.well-known/jwks`;
    const client = new JwksClient({
      jwksUri: jwksUrl,
      rateLimit: true,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });

    const signingKey = await client.getSigningKey();
    const publicKey = signingKey.getPublicKey();

    const decodedToken = jwt.verify(token, publicKey, {
      ignoreExpiration: false,
    }) as JwtPayload;

    if (
      decodedToken.scopes?.includes("requiresAdditionalAuth") &&
      !allowAdditionalAuth
    ) {
      return {
        success: false,
        error: "Additional verification required",
      };
    }

    return {
      success: true,
      payload: decodedToken,
      embedded_wallet_address: getEmbeddedWalletAddress(
        decodedToken as DecodedJWT,
      ),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Token verification failed",
    };
  }
}

/**
 * Get Dynamic ID from JWT
 */
export async function getDynamicIdFromJWT(
  token: string,
  dynamicEnvId: string,
): Promise<{ success: boolean; dynamicId?: string; error?: string }> {
  const tokenVerification = await verifyDynamicJWT(token, dynamicEnvId);

  if (!tokenVerification.success) {
    return {
      success: false,
      error: tokenVerification.error,
    };
  }

  const dynamicId = tokenVerification.payload?.sub;
  if (!dynamicId) {
    return {
      success: false,
      error: "Merchant ID not found in token",
    };
  }

  return {
    success: true,
    dynamicId,
  };
}

/**
 * Verify Privy JWT token
 */
export async function verifyPrivyJWT(
  token: string,
  appId: string,
  appSecret: string,
): Promise<AuthResult> {
  try {
    const privy = new PrivyClient(appId, appSecret);
    const verifiedClaims = await privy.verifyAuthToken(token);

    if (verifiedClaims.appId === appId) {
      const user = await privy.getUserById(verifiedClaims.userId);
      return {
        success: true,
        payload: user,
        embedded_wallet_address: user.wallet?.address || null,
      };
    }

    return {
      success: false,
      error: "Invalid Token or App ID",
    };
  } catch (error) {
    console.log("PRIVY ERROR:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Token verification failed",
    };
  }
}

/**
 * Performs dual authentication (Privy + Dynamic)
 * Privy takes precedence over Dynamic
 */
export async function performDualAuth(
  token: string,
  dynamicEnvId: string,
  privyAppId: string,
  privyAppSecret: string,
): Promise<DualAuthResult> {
  // Verify with Privy
  const privy = await verifyPrivyJWT(token, privyAppId, privyAppSecret);

  // Verify with Dynamic
  const tokenVerification = await verifyDynamicJWT(token, dynamicEnvId);

  // Both failed
  if (!tokenVerification.success && !privy.success) {
    return {
      success: false,
      userProviderId: null,
      userProviderWalletAddress: null,
      isPrivyAuth: false,
      error: "Invalid or expired token",
    };
  }

  let userProviderId: string | null = null;
  let userProviderWalletAddress: string | null = null;
  let isPrivyAuth = false;

  if (tokenVerification.success) {
    userProviderId = tokenVerification.payload?.sub || null;
    userProviderWalletAddress = tokenVerification.embedded_wallet_address ||
      null;
  }

  // Privy takes precedence
  if (privy.success) {
    userProviderId = privy.payload?.id || null;
    userProviderWalletAddress = privy.embedded_wallet_address || null;
    isPrivyAuth = true;
  }

  if (!userProviderWalletAddress || !userProviderId) {
    return {
      success: false,
      userProviderId: null,
      userProviderWalletAddress: null,
      isPrivyAuth: false,
      error: "Missing embedded wallet address or user provider id",
    };
  }

  return {
    success: true,
    userProviderId,
    userProviderWalletAddress,
    isPrivyAuth,
  };
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

export type { AuthResult, DualAuthResult };
