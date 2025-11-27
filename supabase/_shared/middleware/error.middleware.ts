/**
 * Error Handling Middleware
 * Centralized error handling for Hono applications
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { corsHeaders } from "../config/cors.ts";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * Convert to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      ...(this.code && { code: this.code }),
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation Error class (for schema validation failures)
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/**
 * Database Error class
 */
export class DatabaseError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(500, message, "DATABASE_ERROR", {
      original: originalError instanceof Error ? originalError.message : String(originalError),
    });
    this.name = "DatabaseError";
  }
}

/**
 * External Service Error class
 */
export class ExternalServiceError extends ApiError {
  constructor(service: string, message: string, originalError?: unknown) {
    super(502, message, "EXTERNAL_SERVICE_ERROR", {
      service,
      original: originalError instanceof Error ? originalError.message : String(originalError),
    });
    this.name = "ExternalServiceError";
  }
}

/**
 * Rate Limit Error class
 */
export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds?: number) {
    super(
      429,
      "Too many requests. Please try again later.",
      "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined,
    );
    this.name = "RateLimitError";
  }
}

// ============================================================================
// Error Factory
// ============================================================================

/**
 * Create common API errors
 */
export const Errors = {
  // 400 Bad Request
  BadRequest: (message = "Bad request", code?: string) =>
    new ApiError(400, message, code),

  ValidationFailed: (message: string, details?: Record<string, unknown>) =>
    new ValidationError(message, details),

  // 401 Unauthorized
  Unauthorized: (message = "Unauthorized") =>
    new ApiError(401, message, "UNAUTHORIZED"),

  InvalidToken: () =>
    new ApiError(401, "Invalid or expired token", "INVALID_TOKEN"),

  MissingAuth: () =>
    new ApiError(401, "Missing authorization header", "MISSING_AUTH"),

  // 403 Forbidden
  Forbidden: (message = "Forbidden", code?: string) =>
    new ApiError(403, message, code),

  PinRequired: () =>
    new ApiError(400, "PIN code is required for this operation", "PIN_REQUIRED"),

  PinBlocked: () =>
    new ApiError(403, "Account blocked due to PIN security violations", "PIN_BLOCKED"),

  PinInvalid: (attemptsRemaining: number) =>
    new ApiError(403, `Invalid PIN code. ${attemptsRemaining} attempts remaining`, "PIN_INVALID"),

  Inactive: () =>
    new ApiError(403, "Account is inactive", "INACTIVE"),

  // 404 Not Found
  NotFound: (resource = "Resource") =>
    new ApiError(404, `${resource} not found`, "NOT_FOUND"),

  MerchantNotFound: () =>
    new ApiError(404, "Merchant not found", "MERCHANT_NOT_FOUND"),

  OrderNotFound: () =>
    new ApiError(404, "Order not found", "ORDER_NOT_FOUND"),

  DepositNotFound: () =>
    new ApiError(404, "Deposit not found", "DEPOSIT_NOT_FOUND"),

  // 405 Method Not Allowed
  MethodNotAllowed: (method: string) =>
    new ApiError(405, `Method ${method} not allowed`, "METHOD_NOT_ALLOWED"),

  // 409 Conflict
  Conflict: (message = "Conflict") =>
    new ApiError(409, message, "CONFLICT"),

  DuplicateResource: (resource: string) =>
    new ApiError(409, `${resource} already exists`, "DUPLICATE"),

  // 422 Unprocessable Entity
  UnprocessableEntity: (message = "Unprocessable entity") =>
    new ApiError(422, message, "UNPROCESSABLE_ENTITY"),

  InvalidStatus: (currentStatus: string, requiredStatus: string) =>
    new ApiError(
      422,
      `Invalid status. Current: ${currentStatus}, Required: ${requiredStatus}`,
      "INVALID_STATUS",
    ),

  // 429 Too Many Requests
  RateLimited: (retryAfterSeconds?: number) =>
    new RateLimitError(retryAfterSeconds),

  // 500 Internal Server Error
  InternalError: (message = "Internal server error") =>
    new ApiError(500, message, "INTERNAL_ERROR"),

  DatabaseFailed: (operation: string, error?: unknown) =>
    new DatabaseError(`Database ${operation} failed`, error),

  // 502 Bad Gateway
  ExternalServiceFailed: (service: string, error?: unknown) =>
    new ExternalServiceError(service, `${service} service unavailable`, error),

  // 503 Service Unavailable
  ServiceUnavailable: (message = "Service temporarily unavailable") =>
    new ApiError(503, message, "SERVICE_UNAVAILABLE"),
};

// ============================================================================
// Result Type for Consistent Error Handling
// ============================================================================

/**
 * Result type for operations that can fail
 * Use this pattern for service layer functions
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E; code?: string };

/**
 * Create a success result
 */
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function err<E = string>(error: E, code?: string): Result<never, E> {
  return { success: false, error, code };
}

/**
 * Convert Result to ApiError if failed
 */
export function resultToError<T>(result: Result<T>, statusCode = 400): T {
  if (result.success) {
    return result.data;
  }
  throw new ApiError(statusCode, String(result.error), result.code);
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Error handling middleware
 * Catches all errors and formats them consistently
 */
export const errorMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  try {
    await next();
  } catch (error) {
    // Log error with request context
    const requestId = c.req.header("x-request-id") || crypto.randomUUID();
    console.error(`[${requestId}] Error caught by middleware:`, error);

    // Handle ApiError (includes ValidationError, DatabaseError, etc.)
    if (error instanceof ApiError) {
      return c.json(error.toJSON(), error.statusCode);
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error,
        },
        400,
      );
    }

    // Handle other errors
    const message = error instanceof Error
      ? error.message
      : "Internal server error";

    return c.json(
      {
        success: false,
        error: `Server error: ${message}`,
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
};

/**
 * Not found handler for Hono
 */
export const notFoundHandler = (c: Context) => {
  return c.json(
    {
      success: false,
      error: "Route not found",
      code: "NOT_FOUND",
    },
    404,
  );
};

/**
 * Create standardized error response (for non-Hono use)
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = "Internal server error",
): Response {
  if (error instanceof ApiError) {
    return Response.json(error.toJSON(), {
      status: error.statusCode,
      headers: corsHeaders,
    });
  }

  const message = error instanceof Error ? error.message : defaultMessage;
  return Response.json(
    {
      success: false,
      error: `Server error: ${message}`,
      code: "INTERNAL_ERROR",
    },
    { status: 500, headers: corsHeaders },
  );
}

/**
 * Wrap async handlers to automatically catch errors
 * Usage: app.get("/", wrapHandler(async (c) => { ... }))
 */
export function wrapHandler<T>(
  handler: (c: Context) => Promise<T>,
): (c: Context) => Promise<T | Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      if (error instanceof ApiError) {
        return c.json(error.toJSON(), error.statusCode);
      }
      throw error; // Let middleware handle it
    }
  };
}
