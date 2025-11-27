/**
 * OpenAPI 3.0 Specification for Rozo Backend API
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Rozo Backend API",
    description: `
## Overview
Rozo Backend API provides payment processing, merchant management, and wallet operations for the Rozo payment platform.

## Authentication
Most endpoints require authentication using JWT tokens from either:
- **Dynamic** - Web3 authentication provider
- **Privy** - Embedded wallet authentication

Include the JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## PIN Security
Some sensitive operations (withdrawals, wallet transfers) require PIN validation.
Include the PIN code in the header:
\`\`\`
X-Pin-Code: <6-digit-pin>
\`\`\`
    `,
    version: "1.0.0",
    contact: {
      name: "Rozo Support",
      url: "https://rozo.ai",
    },
  },
  servers: [
    {
      url: "https://intentapiv2.rozo.ai/functions/v1",
      description: "Production server",
    },
    {
      url: "http://localhost:54321/functions/v1",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Merchants", description: "Merchant profile and PIN management" },
    { name: "Orders", description: "Order creation and management" },
    { name: "Deposits", description: "Deposit operations" },
    { name: "Withdrawals", description: "Withdrawal history and requests" },
    { name: "Wallets", description: "Wallet transactions and Stellar operations" },
    { name: "Devices", description: "FCM device registration for push notifications" },
    { name: "Reports", description: "Dashboard reporting and analytics" },
  ],
  paths: {
    // =========================================================================
    // MERCHANTS
    // =========================================================================
    "/merchants": {
      get: {
        tags: ["Merchants"],
        summary: "Get merchant profile",
        description: "Retrieve the authenticated merchant's profile information",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Merchant profile retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantProfileResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Merchants"],
        summary: "Create or update merchant",
        description: "Create a new merchant or update existing merchant profile (upsert)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateMerchantRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Merchant created/updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantProfileResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Merchants"],
        summary: "Update merchant profile",
        description: "Update merchant profile fields including logo upload",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateMerchantRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Merchant updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantProfileResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/merchants/status": {
      get: {
        tags: ["Merchants"],
        summary: "Get merchant status",
        description: "Check merchant account status and PIN configuration",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Merchant status retrieved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantStatusResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/merchants/pin": {
      post: {
        tags: ["Merchants"],
        summary: "Set PIN code",
        description: "Set a new PIN code for the merchant account",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetPinRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "PIN set successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PinResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      put: {
        tags: ["Merchants"],
        summary: "Update PIN code",
        description: "Update existing PIN code (requires current PIN)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePinRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "PIN updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PinResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["Merchants"],
        summary: "Revoke PIN code",
        description: "Remove PIN code from account (requires current PIN)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetPinRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "PIN revoked successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PinResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/merchants/pin/validate": {
      post: {
        tags: ["Merchants"],
        summary: "Validate PIN code",
        description: "Validate PIN code without performing any action",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetPinRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "PIN validation result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PinValidationResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // =========================================================================
    // ORDERS
    // =========================================================================
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        description: "Get paginated list of merchant orders with optional status filter",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { $ref: "#/components/parameters/StatusParam" },
        ],
        responses: {
          "200": {
            description: "Orders retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create order",
        description: "Create a new payment order with Daimo Pay integration",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrderRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Order created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateOrderResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Get order by ID",
        description: "Retrieve a specific order by its ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Order UUID",
          },
        ],
        responses: {
          "200": {
            description: "Order retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/orders/number/{orderNumber}": {
      get: {
        tags: ["Orders"],
        summary: "Get order by number",
        description: "Retrieve an order by its human-readable number",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "orderNumber",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Order number (e.g., 2025062301234567)",
          },
        ],
        responses: {
          "200": {
            description: "Order retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =========================================================================
    // DEPOSITS
    // =========================================================================
    "/deposits": {
      get: {
        tags: ["Deposits"],
        summary: "List deposits",
        description: "Get paginated list of merchant deposits",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { $ref: "#/components/parameters/StatusParam" },
        ],
        responses: {
          "200": {
            description: "Deposits retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DepositListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Deposits"],
        summary: "Create deposit",
        description: "Create a new deposit request",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDepositRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Deposit created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateDepositResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/deposits/{depositId}": {
      get: {
        tags: ["Deposits"],
        summary: "Get deposit by ID",
        description: "Retrieve a specific deposit by its ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "depositId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Deposit retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DepositResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =========================================================================
    // WITHDRAWALS
    // =========================================================================
    "/withdrawals": {
      get: {
        tags: ["Withdrawals"],
        summary: "List withdrawals",
        description: "Get withdrawal history for the merchant",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Withdrawals retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WithdrawalListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Withdrawals"],
        summary: "Create withdrawal",
        description: "Create a new withdrawal request (requires PIN if enabled)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/PinCodeHeader" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateWithdrawalRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Withdrawal created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WithdrawalResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // =========================================================================
    // WALLETS
    // =========================================================================
    "/wallets/{walletId}": {
      post: {
        tags: ["Wallets"],
        summary: "Send USDC transaction",
        description: "Send USDC from merchant wallet to recipient address (requires PIN if enabled)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Privy wallet ID",
          },
          { $ref: "#/components/parameters/PinCodeHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WalletTransactionRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Transaction submitted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WalletTransactionResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wallets/{walletId}/stellar/trustline": {
      post: {
        tags: ["Wallets"],
        summary: "Create USDC trustline",
        description: "Create a USDC trustline on Stellar network for the wallet",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/PinCodeHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StellarTrustlineRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Trustline created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StellarTrustlineResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wallets/{walletId}/stellar/transfer": {
      post: {
        tags: ["Wallets"],
        summary: "Send Stellar USDC",
        description: "Send USDC on Stellar network",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/PinCodeHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StellarTransferRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Transfer submitted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StellarTransferResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // =========================================================================
    // DEVICES
    // =========================================================================
    "/devices": {
      get: {
        tags: ["Devices"],
        summary: "List registered devices",
        description: "Get all FCM devices registered for the merchant",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Devices retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeviceListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Devices"],
        summary: "Register device",
        description: "Register a new FCM device for push notifications",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterDeviceRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Device registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeviceResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/devices/{deviceId}": {
      delete: {
        tags: ["Devices"],
        summary: "Unregister device",
        description: "Remove a registered FCM device",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "deviceId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Device unregistered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =========================================================================
    // REPORTS
    // =========================================================================
    "/reports": {
      get: {
        tags: ["Reports"],
        summary: "Get dashboard report",
        description: "Generate dashboard report with charts data for the specified date range",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "from",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
            description: "Start date (YYYY-MM-DD)",
            example: "2025-01-01",
          },
          {
            name: "to",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
            description: "End date (YYYY-MM-DD)",
            example: "2025-01-31",
          },
          {
            name: "group_by",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["day", "week", "month"],
              default: "day",
            },
            description: "Group results by time period",
          },
        ],
        responses: {
          "200": {
            description: "Report generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReportResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from Dynamic or Privy authentication",
      },
    },
    parameters: {
      LimitParam: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        description: "Number of items to return (max 20)",
      },
      OffsetParam: {
        name: "offset",
        in: "query",
        schema: { type: "integer", minimum: 0, default: 0 },
        description: "Number of items to skip",
      },
      StatusParam: {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "completed", "failed", "expired", "discrepancy"],
        },
        description: "Filter by status",
      },
      PinCodeHeader: {
        name: "X-Pin-Code",
        in: "header",
        schema: { type: "string", pattern: "^[0-9]{6}$" },
        description: "6-digit PIN code (required if PIN is enabled)",
      },
    },
    responses: {
      BadRequest: {
        description: "Bad Request - Invalid input",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized - Invalid or missing authentication",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Forbidden: {
        description: "Forbidden - Account blocked or insufficient permissions",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFound: {
        description: "Not Found - Resource does not exist",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
    schemas: {
      // Common
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
          code: { type: "string" },
        },
      },

      // Merchant schemas
      MerchantProfile: {
        type: "object",
        properties: {
          merchant_id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          display_name: { type: "string" },
          description: { type: "string" },
          logo_url: { type: "string", format: "uri" },
          wallet_address: { type: "string" },
          stellar_address: { type: "string" },
          default_token_id: { type: "string" },
          default_currency: { type: "string" },
          default_language: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE", "PIN_BLOCKED"] },
          has_pin: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      MerchantProfileResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          profile: { $ref: "#/components/schemas/MerchantProfile" },
          message: { type: "string" },
        },
      },
      MerchantStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          status: { type: "string" },
          has_pin: { type: "boolean" },
          pin_attempts: { type: "integer" },
          pin_blocked_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      CreateMerchantRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
          display_name: { type: "string" },
          description: { type: "string" },
          logo_url: { type: "string", format: "uri" },
          default_currency: { type: "string", example: "USD" },
          default_language: { type: "string", example: "en" },
        },
      },
      UpdateMerchantRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          display_name: { type: "string" },
          logo: { type: "string", description: "Base64 encoded image" },
          default_token_id: { type: "string" },
          stellar_address: { type: "string" },
        },
      },
      SetPinRequest: {
        type: "object",
        required: ["pin_code"],
        properties: {
          pin_code: { type: "string", pattern: "^[0-9]{6}$", example: "123456" },
        },
      },
      UpdatePinRequest: {
        type: "object",
        required: ["current_pin", "new_pin"],
        properties: {
          current_pin: { type: "string", pattern: "^[0-9]{6}$" },
          new_pin: { type: "string", pattern: "^[0-9]{6}$" },
        },
      },
      PinResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      PinValidationResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          attempts_remaining: { type: "integer" },
          is_blocked: { type: "boolean" },
          message: { type: "string" },
        },
      },

      // Order schemas
      Order: {
        type: "object",
        properties: {
          order_id: { type: "string", format: "uuid" },
          number: { type: "string", example: "2025062301234567" },
          merchant_id: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "DISCREPANCY"] },
          display_amount: { type: "number", example: 100.50 },
          display_currency: { type: "string", example: "USD" },
          required_amount_usd: { type: "number" },
          payment_url: { type: "string", format: "uri" },
          payment_id: { type: "string" },
          expired_at: { type: "string", format: "date-time" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      OrderListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
          count: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
      OrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Order" },
        },
      },
      CreateOrderRequest: {
        type: "object",
        required: ["display_amount", "display_currency"],
        properties: {
          display_amount: { type: "number", minimum: 0.1, example: 100.50 },
          display_currency: { type: "string", example: "USD" },
          preferred_token_id: { type: "string", example: "USDC_BASE" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
      CreateOrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Order" },
          payment_url: { type: "string", format: "uri" },
        },
      },

      // Deposit schemas
      Deposit: {
        type: "object",
        properties: {
          deposit_id: { type: "string", format: "uuid" },
          number: { type: "string" },
          merchant_id: { type: "string", format: "uuid" },
          status: { type: "string" },
          display_amount: { type: "number" },
          display_currency: { type: "string" },
          payment_url: { type: "string", format: "uri" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      DepositListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Deposit" } },
          count: { type: "integer" },
        },
      },
      DepositResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Deposit" },
        },
      },
      CreateDepositRequest: {
        type: "object",
        required: ["display_amount", "display_currency"],
        properties: {
          display_amount: { type: "number", minimum: 0.1 },
          display_currency: { type: "string" },
          preferred_token_id: { type: "string" },
        },
      },
      CreateDepositResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Deposit" },
          payment_url: { type: "string", format: "uri" },
        },
      },

      // Withdrawal schemas
      Withdrawal: {
        type: "object",
        properties: {
          withdrawal_id: { type: "string", format: "uuid" },
          merchant_id: { type: "string", format: "uuid" },
          recipient: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          tx_hash: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      WithdrawalListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Withdrawal" } },
          count: { type: "integer" },
        },
      },
      WithdrawalResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Withdrawal" },
        },
      },
      CreateWithdrawalRequest: {
        type: "object",
        required: ["recipient", "amount", "currency"],
        properties: {
          recipient: { type: "string", description: "Wallet address" },
          amount: { type: "number", minimum: 0 },
          currency: { type: "string", example: "USDC" },
        },
      },

      // Wallet schemas
      WalletTransactionRequest: {
        type: "object",
        required: ["recipientAddress", "amount", "signature"],
        properties: {
          recipientAddress: { type: "string", description: "EVM address (0x...)" },
          amount: { type: "number", minimum: 0 },
          signature: { type: "string", description: "Authorization signature" },
          requestId: { type: "string", description: "Idempotency key" },
        },
      },
      WalletTransactionResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          hash: { type: "string" },
          caip2: { type: "string" },
          walletId: { type: "string" },
        },
      },
      StellarTrustlineRequest: {
        type: "object",
        required: ["signerPublicKey"],
        properties: {
          signerPublicKey: { type: "string", description: "Stellar public key (G...)" },
        },
      },
      StellarTrustlineResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          hash: { type: "string" },
          ledger: { type: "integer" },
          message: { type: "string" },
        },
      },
      StellarTransferRequest: {
        type: "object",
        required: ["signerPublicKey", "destinationAddress", "amount"],
        properties: {
          signerPublicKey: { type: "string" },
          destinationAddress: { type: "string", description: "Stellar address (G...)" },
          amount: { type: "string", example: "10.5" },
        },
      },
      StellarTransferResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          hash: { type: "string" },
          ledger: { type: "integer" },
        },
      },

      // Device schemas
      Device: {
        type: "object",
        properties: {
          device_id: { type: "string", format: "uuid" },
          merchant_id: { type: "string", format: "uuid" },
          fcm_token: { type: "string" },
          device_name: { type: "string" },
          platform: { type: "string", enum: ["ios", "android", "web"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      DeviceListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Device" } },
          count: { type: "integer" },
        },
      },
      DeviceResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Device" },
        },
      },
      RegisterDeviceRequest: {
        type: "object",
        required: ["fcm_token"],
        properties: {
          fcm_token: { type: "string" },
          device_name: { type: "string" },
          platform: { type: "string", enum: ["ios", "android", "web"] },
        },
      },

      // Report schemas
      ReportResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              merchant_id: { type: "string" },
              date_range: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                },
              },
              summary: {
                type: "object",
                properties: {
                  total_completed_orders: { type: "integer" },
                  total_required_amount_usd: { type: "number" },
                  total_display_amounts: { type: "object", additionalProperties: { type: "number" } },
                },
              },
              charts: {
                type: "object",
                properties: {
                  daily_trends: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        orders_count: { type: "integer" },
                        usd_amount: { type: "number" },
                      },
                    },
                  },
                  currency_breakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        currency: { type: "string" },
                        amount: { type: "number" },
                        percentage: { type: "number" },
                      },
                    },
                  },
                  order_volume: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        count: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
