/**
 * Logging Middleware
 * Request logging and tracing for Hono applications
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Logging middleware
 * Logs request details and response times
 */
export const loggingMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Set request ID in context
  c.set("requestId", requestId);

  // Log incoming request
  console.log(
    JSON.stringify({
      type: "request",
      requestId,
      method: c.req.method,
      path: c.req.path,
      timestamp: new Date().toISOString(),
    }),
  );

  try {
    await next();
  } finally {
    const duration = Date.now() - startTime;

    // Log response
    console.log(
      JSON.stringify({
        type: "response",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }),
    );
  }
};

/**
 * Simple performance logging middleware
 * Only logs duration without structured logging
 */
export const performanceMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const startTime = Date.now();

  await next();

  const duration = Date.now() - startTime;
  console.log(`${c.req.method} ${c.req.path} - ${duration}ms`);
};

/**
 * Debug logging utility for handlers
 */
export function logDebug(
  requestId: string,
  step: string,
  data?: unknown,
): void {
  console.log(
    JSON.stringify({
      type: "debug",
      requestId,
      step,
      data,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Error logging utility for handlers
 */
export function logError(
  requestId: string,
  step: string,
  error: unknown,
): void {
  console.error(
    JSON.stringify({
      type: "error",
      requestId,
      step,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }),
  );
}

// Type declaration for request ID in context
declare module "jsr:@hono/hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}
