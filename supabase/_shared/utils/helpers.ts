/**
 * General Helper Utilities
 */

/**
 * Generates a human-readable order number using the current date (YYYYMMDD)
 * followed by 8 random digits (padded with leading zeros if necessary).
 * Example: 2025062301234567
 */
export function generateOrderNumber(): string {
  const now = new Date();

  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const datePart = `${year}${month}${day}`;

  // Generate 8-digit random number with padding
  const randomPart = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");

  return `${datePart}${randomPart}`;
}

/**
 * Extract PIN code from request headers
 */
export function extractPinFromHeaders(request: Request): string | null {
  return request.headers.get("x-pin-code");
}

/**
 * Extract client information from request
 */
export function extractClientInfo(
  request: Request,
): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

/**
 * Parse URL path segments
 */
export function getPathSegments(url: string): string[] {
  const urlObj = new URL(url);
  return urlObj.pathname.split("/").filter(Boolean);
}

/**
 * Parse pagination parameters from URL
 */
export function parsePaginationParams(
  url: URL,
  defaultLimit = 10,
  maxLimit = 20,
): {
  limit: number;
  offset: number;
  error?: string;
} {
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  let limit = defaultLimit;
  let offset = 0;

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return { limit: 0, offset: 0, error: "Limit must be a positive integer" };
    }
    limit = Math.min(parsedLimit, maxLimit);
  }

  if (offsetParam) {
    const parsedOffset = parseInt(offsetParam, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return {
        limit: 0,
        offset: 0,
        error: "Offset must be a non-negative integer",
      };
    }
    offset = parsedOffset;
  }

  return { limit, offset };
}

/**
 * Generate Basic Auth header
 */
export function generateBasicAuthHeader(
  username: string,
  password: string,
): string {
  const token = btoa(`${username}:${password}`);
  return `Basic ${token}`;
}

/**
 * Format date to ISO string for database
 */
export function formatISODate(date?: Date): string {
  return (date || new Date()).toISOString();
}

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Debug logging utilities
 */
export function debugLog(step: string, data?: unknown): void {
  console.log(`[DEBUG] ${step}`, data ? JSON.stringify(data, null, 2) : "");
}

export function debugError(step: string, error: unknown): void {
  console.error(`[ERROR] ${step}:`, error);
}

export function debugSuccess(step: string, data?: unknown): void {
  console.log(`[SUCCESS] ${step}`, data ? JSON.stringify(data, null, 2) : "");
}
