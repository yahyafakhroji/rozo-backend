/**
 * Webhook Utilities
 * Signature verification and validation for webhook payloads
 */

// ============================================================================
// Types
// ============================================================================

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookSignatureConfig {
  /** Header name containing the signature */
  signatureHeader: string;
  /** Secret key for HMAC verification */
  secret: string;
  /** Algorithm to use (default: SHA-256) */
  algorithm?: "SHA-256" | "SHA-384" | "SHA-512";
  /** Tolerance for timestamp verification in seconds (default: 300) */
  timestampTolerance?: number;
  /** Header name containing the timestamp */
  timestampHeader?: string;
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify webhook signature using HMAC
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "SHA-256" | "SHA-384" | "SHA-512" = "SHA-256",
): Promise<boolean> {
  try {
    // Convert secret to key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: algorithm },
      false,
      ["sign", "verify"],
    );

    // Compute expected signature
    const data = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);

    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Time-safe comparison
    return timingSafeEqual(signature.toLowerCase(), expectedSignature);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Time-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify timestamp is within acceptable range
 */
export function verifyWebhookTimestamp(
  timestamp: string | number,
  toleranceSeconds = 300,
): boolean {
  const webhookTime = typeof timestamp === "string"
    ? new Date(timestamp).getTime()
    : timestamp * 1000; // Convert seconds to milliseconds if number

  if (isNaN(webhookTime)) {
    return false;
  }

  const now = Date.now();
  const difference = Math.abs(now - webhookTime);

  return difference <= toleranceSeconds * 1000;
}

// ============================================================================
// Daimo Webhook Verification
// ============================================================================

/**
 * Verify Daimo Pay webhook signature
 * Daimo uses HMAC-SHA256 for webhook signatures
 */
export async function verifyDaimoWebhook(
  payload: string,
  headers: Headers,
): Promise<WebhookVerificationResult> {
  // Get webhook secret from environment
  const secret = Deno.env.get("DAIMO_WEBHOOK_SECRET");

  // If no secret is configured, skip verification (for development)
  if (!secret) {
    console.warn("DAIMO_WEBHOOK_SECRET not configured, skipping signature verification");
    return { valid: true };
  }

  // Get signature from header
  const signature = headers.get("x-daimo-signature") ||
    headers.get("x-webhook-signature") ||
    headers.get("x-signature");

  if (!signature) {
    return {
      valid: false,
      error: "Missing webhook signature header",
    };
  }

  // Parse signature (format: "sha256=<hex>")
  let signatureValue = signature;
  if (signature.startsWith("sha256=")) {
    signatureValue = signature.slice(7);
  }

  // Verify signature
  const isValid = await verifyWebhookSignature(
    payload,
    signatureValue,
    secret,
    "SHA-256",
  );

  if (!isValid) {
    return {
      valid: false,
      error: "Invalid webhook signature",
    };
  }

  // Verify timestamp if present
  const timestamp = headers.get("x-webhook-timestamp") ||
    headers.get("x-daimo-timestamp");

  if (timestamp) {
    const isTimestampValid = verifyWebhookTimestamp(timestamp);
    if (!isTimestampValid) {
      return {
        valid: false,
        error: "Webhook timestamp out of range",
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Generic Webhook Verification
// ============================================================================

/**
 * Create a webhook verifier for a specific service
 */
export function createWebhookVerifier(config: WebhookSignatureConfig) {
  return async (
    payload: string,
    headers: Headers,
  ): Promise<WebhookVerificationResult> => {
    const signature = headers.get(config.signatureHeader);

    if (!signature) {
      return {
        valid: false,
        error: `Missing ${config.signatureHeader} header`,
      };
    }

    // Verify signature
    const isValid = await verifyWebhookSignature(
      payload,
      signature,
      config.secret,
      config.algorithm || "SHA-256",
    );

    if (!isValid) {
      return {
        valid: false,
        error: "Invalid webhook signature",
      };
    }

    // Verify timestamp if configured
    if (config.timestampHeader) {
      const timestamp = headers.get(config.timestampHeader);
      if (timestamp) {
        const isTimestampValid = verifyWebhookTimestamp(
          timestamp,
          config.timestampTolerance || 300,
        );
        if (!isTimestampValid) {
          return {
            valid: false,
            error: "Webhook timestamp out of range",
          };
        }
      }
    }

    return { valid: true };
  };
}

// ============================================================================
// Webhook Payload Parsing
// ============================================================================

/**
 * Safely parse webhook JSON payload
 */
export function parseWebhookPayload<T>(
  payload: string,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(payload) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON payload: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Extract raw body from request for signature verification
 * The body must be read before parsing for signature verification to work
 */
export async function extractRawBody(request: Request): Promise<string> {
  const clone = request.clone();
  return await clone.text();
}
