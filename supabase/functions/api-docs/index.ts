/**
 * API Documentation Function
 * Serves OpenAPI specification and Swagger UI
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// OpenAPI specification
import { openApiSpec } from "./openapi.ts";

const app = new Hono().basePath("/api-docs");

// Apply CORS for all origins
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "OPTIONS"],
}));

// ============================================================================
// Swagger UI HTML Template
// ============================================================================

const swaggerUIHtml = (specUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rozo API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { font-size: 36px; }
    .swagger-ui .scheme-container { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    /* Custom Rozo branding */
    .swagger-ui .info hgroup.main a { color: #6366f1; }
    .swagger-ui .btn.authorize { background: #6366f1; border-color: #6366f1; }
    .swagger-ui .btn.authorize:hover { background: #4f46e5; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #6366f1; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #22c55e; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #f59e0b; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ef4444; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>
`;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api-docs - Swagger UI
 */
app.get("/", (c) => {
  const baseUrl = new URL(c.req.url);
  const specUrl = `${baseUrl.protocol}//${baseUrl.host}/api-docs/openapi.json`;

  return c.html(swaggerUIHtml(specUrl));
});

/**
 * GET /api-docs/openapi.json - OpenAPI JSON specification
 */
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

/**
 * GET /api-docs/openapi.yaml - OpenAPI YAML specification (simplified)
 */
app.get("/openapi.yaml", (c) => {
  // Return JSON with YAML content-type for tools that expect YAML
  // Most tools can handle JSON even when requesting YAML
  c.header("Content-Type", "application/x-yaml");
  return c.json(openApiSpec);
});

/**
 * GET /api-docs/health - Health check
 */
app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "API Documentation is available",
    endpoints: {
      swagger_ui: "/api-docs",
      openapi_json: "/api-docs/openapi.json",
      openapi_yaml: "/api-docs/openapi.yaml",
    },
    version: openApiSpec.info.version,
  });
});

// Not found handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: "Documentation endpoint not found",
    available_endpoints: [
      "/api-docs",
      "/api-docs/openapi.json",
      "/api-docs/openapi.yaml",
      "/api-docs/health",
    ],
  }, 404);
});

// Export for Deno
Deno.serve(app.fetch);
