/**
 * Debug Utilities
 * Centralized logging functions with configurable prefixes
 */

export type LogLevel = "debug" | "error" | "success" | "warn" | "info";

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string) {
  return {
    debug: (step: string, data?: unknown) => debugLog(prefix, step, data),
    error: (step: string, error: unknown) => debugError(prefix, step, error),
    success: (step: string, data?: unknown) => debugSuccess(prefix, step, data),
    warn: (step: string, data?: unknown) => debugWarn(prefix, step, data),
    info: (step: string, data?: unknown) => debugInfo(prefix, step, data),
  };
}

/**
 * Debug log with prefix
 */
export function debugLog(prefix: string, step: string, data?: unknown): void {
  console.log(
    `🔍 [${prefix}] ${step}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

/**
 * Error log with prefix
 */
export function debugError(prefix: string, step: string, error: unknown): void {
  console.error(`❌ [${prefix}] ${step}:`, error);
}

/**
 * Success log with prefix
 */
export function debugSuccess(prefix: string, step: string, data?: unknown): void {
  console.log(
    `✅ [${prefix}] ${step}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

/**
 * Warning log with prefix
 */
export function debugWarn(prefix: string, step: string, data?: unknown): void {
  console.warn(
    `⚠️ [${prefix}] ${step}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

/**
 * Info log with prefix
 */
export function debugInfo(prefix: string, step: string, data?: unknown): void {
  console.info(
    `ℹ️ [${prefix}] ${step}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

// Pre-configured loggers for common modules
export const walletLogger = createLogger("WALLET");
export const stellarTransferLogger = createLogger("STELLAR_TRANSFER");
export const stellarTrustlineLogger = createLogger("STELLAR_TRUSTLINE");
export const paymentLogger = createLogger("PAYMENT");
export const orderLogger = createLogger("ORDER");
