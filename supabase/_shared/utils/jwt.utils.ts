/**
 * JWT Utilities
 * JWT verification and extraction utilities for Privy authentication
 */

import { PrivyClient } from "npm:@privy-io/server-auth";
import type { AuthResult } from "../types/auth.types.ts";

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

export type { AuthResult };
