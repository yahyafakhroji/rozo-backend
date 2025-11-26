/**
 * Error Handling Middleware
 * Centralized error handling for Hono applications
 */

import { Context, Next, MiddlewareHandler } from "jsr:@hono/hono";
import { corsHeaders } from "../config/cors.ts";

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Create common API errors
 */
export const Errors = {
  BadRequest: (message = "Bad request", code?: string) =>
    new ApiError(400, message, code),

  Unauthorized: (message = "Unauthorized") =>
    new ApiError(401, message),

  Forbidden: (message = "Forbidden", code?: string) =>
    new ApiError(403, message, code),

  NotFound: (message = "Not found") =>
    new ApiError(404, message),

  MethodNotAllowed: (method: string) =>
    new ApiError(405, `Method ${method} not allowed`),

  Conflict: (message = "Conflict") =>
    new ApiError(409, message),

  UnprocessableEntity: (message = "Unprocessable entity") =>
    new ApiError(422, message),

  InternalError: (message = "Internal server error") =>
    new ApiError(500, message),

  PinRequired: () =>
    new ApiError(400, "PIN code is required for this operation", "PIN_REQUIRED"),

  PinBlocked: () =>
    new ApiError(403, "Account blocked due to PIN security violations", "PIN_BLOCKED"),

  Inactive: () =>
    new ApiError(403, "Account is inactive", "INACTIVE"),
};

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
    console.error("Error caught by middleware:", error);

    // Handle ApiError
    if (error instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: error.message,
          ...(error.code && { code: error.code }),
        },
        error.statusCode,
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
    return Response.json(
      {
        success: false,
        error: error.message,
        ...(error.code && { code: error.code }),
      },
      { status: error.statusCode, headers: corsHeaders },
    );
  }

  const message = error instanceof Error ? error.message : defaultMessage;
  return Response.json(
    {
      success: false,
      error: `Server error: ${message}`,
    },
    { status: 500, headers: corsHeaders },
  );
}
