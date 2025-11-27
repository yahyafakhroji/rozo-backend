/**
 * CORS Configuration
 * Single source of truth for CORS headers
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pin-code",
  "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
} as const;

/**
 * Create a Response with CORS headers applied
 */
export function withCors(response: Response): Response {
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}

/**
 * Create OPTIONS response for CORS preflight
 */
export function corsPreflightResponse(): Response {
  return new Response("ok", { headers: corsHeaders });
}

/**
 * CORS middleware configuration for Hono
 */
export const corsConfig = {
  origin: "*",
  allowHeaders: [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-pin-code",
  ],
  allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"] as string[],
};
