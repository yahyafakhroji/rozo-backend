/**
 * OpenAPI 3.0 Specification for Rozo Backend API
 * Updated for new API structure with /profile, /wallets, /transfers, /cron
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Rozo Backend API",
    description: `
## Overview
Rozo Backend API provides payment processing, merchant management, and wallet operations for the Rozo payment platform.

## Authentication
All endpoints require authentication using JWT tokens from **Privy** (embedded wallet authentication).

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
    version: "2.0.0",
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
    { name: "Profile", description: "Merchant profile and PIN management" },
    { name: "Wallets", description: "Multi-chain wallet management" },
    { name: "Transfers", description: "Wallet transfers (EVM and Stellar)" },
    { name: "Orders", description: "Order creation and management" },
    { name: "Deposits", description: "Deposit operations" },
    { name: "Withdrawals", description: "Withdrawal history and requests" },
    { name: "Devices", description: "FCM device registration for push notifications" },
    { name: "Reports", description: "Dashboard reporting and analytics" },
    { name: "Cron", description: "Internal cron job endpoints" },
  ],
  paths: {
    // =========================================================================
    // PROFILE (was /merchants)
    // =========================================================================
    "/profile": {
      get: {
        tags: ["Profile"],
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
        tags: ["Profile"],
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
        tags: ["Profile"],
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
    "/profile/status": {
      get: {
        tags: ["Profile"],
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
    "/profile/pin": {
      post: {
        tags: ["Profile"],
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
        tags: ["Profile"],
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
        tags: ["Profile"],
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
    "/profile/pin/validate": {
      post: {
        tags: ["Profile"],
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
    // WALLETS (wallet management + chains)
    // =========================================================================
    "/wallets": {
      get: {
        tags: ["Wallets"],
        summary: "List merchant wallets",
        description: "Get all wallets registered for the authenticated merchant across all chains",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Wallets retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Wallets"],
        summary: "Add wallet",
        description: "Add a new wallet address for a specific chain. First wallet for a chain is automatically set as primary.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddMerchantWalletRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Wallet added successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wallets/chains": {
      get: {
        tags: ["Wallets"],
        summary: "List supported chains",
        description: "Get all active blockchain networks supported by the platform",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Chains retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChainListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wallets/sync": {
      post: {
        tags: ["Wallets"],
        summary: "Sync Privy wallet",
        description: "Sync the authenticated user's Privy embedded wallet to the wallets table. Called after login to ensure wallet is registered.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  chain_id: {
                    type: "string",
                    description: "Chain ID for the wallet (defaults to 8453 for Base)",
                    example: "8453",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Wallet synced successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletSyncResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/wallets/{walletId}": {
      get: {
        tags: ["Wallets"],
        summary: "Get wallet by ID",
        description: "Retrieve a specific wallet by its ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Wallet UUID",
          },
        ],
        responses: {
          "200": {
            description: "Wallet retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Wallets"],
        summary: "Update wallet",
        description: "Update wallet label or primary status",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateMerchantWalletRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Wallet updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Wallets"],
        summary: "Delete wallet",
        description: "Remove a wallet from the merchant account. Cannot delete the only wallet for a chain if it's primary.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Wallet deleted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/wallets/{walletId}/primary": {
      put: {
        tags: ["Wallets"],
        summary: "Set wallet as primary",
        description: "Set a wallet as the primary wallet for its chain. The previous primary wallet for that chain will be demoted.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Wallet set as primary successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantWalletPrimaryResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/wallets/{walletId}/balance": {
      get: {
        tags: ["Wallets"],
        summary: "Get wallet balance",
        description: "Get the balance of a wallet. Supports token_id or asset query params to specify which token balance to retrieve. Uses Privy API for balance lookup.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "walletId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Wallet UUID from wallets table",
          },
          {
            name: "token_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Token ID from tokens table to get specific token balance",
          },
          {
            name: "asset",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["usdc", "eth", "sol", "usdt", "pol"],
              default: "usdc",
            },
            description: "Direct asset name (fallback if no token_id provided)",
          },
        ],
        responses: {
          "200": {
            description: "Wallet balance retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WalletBalanceResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =========================================================================
    // TRANSFERS (was /wallets/:walletId for transfers)
    // =========================================================================
    "/transfers/evm": {
      post: {
        tags: ["Transfers"],
        summary: "Send EVM USDC transaction",
        description: "Send USDC from merchant wallet to recipient address on EVM chain (requires PIN if enabled)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/PinCodeHeader" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EVMTransferRequest" },
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
    "/transfers/stellar/trustline": {
      post: {
        tags: ["Transfers"],
        summary: "Enable USDC on Stellar",
        description: "Create a USDC trustline on Stellar network for the wallet (requires PIN if enabled)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/PinCodeHeader" }],
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
    "/transfers/stellar": {
      post: {
        tags: ["Transfers"],
        summary: "Send Stellar USDC",
        description: "Send USDC on Stellar network (requires PIN if enabled)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/PinCodeHeader" }],
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
    // ORDERS (unchanged)
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
    "/orders/{orderId}/regenerate-payment": {
      post: {
        tags: ["Orders"],
        summary: "Regenerate payment link",
        description: "Regenerate payment link for an existing order",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegeneratePaymentRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Payment link regenerated",
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

    // =========================================================================
    // DEPOSITS (unchanged)
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
    // WITHDRAWALS (unchanged)
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
    // DEVICES (simplified routes)
    // =========================================================================
    "/devices": {
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
          "200": {
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
            schema: { type: "string" },
            description: "Device ID",
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
    // REPORTS (unchanged)
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
    "/reports/quick-stats": {
      get: {
        tags: ["Reports"],
        summary: "Get quick stats",
        description: "Get quick statistics summary for dashboard",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Quick stats retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuickStatsResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // =========================================================================
    // CRON (internal endpoints)
    // =========================================================================
    "/cron/expired-orders": {
      post: {
        tags: ["Cron"],
        summary: "Process expired orders",
        description: "Internal cron endpoint to process expired orders",
        responses: {
          "200": {
            description: "Expired orders processed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CronResponse" },
              },
            },
          },
        },
      },
    },
    "/cron/expired-orders/health": {
      get: {
        tags: ["Cron"],
        summary: "Health check",
        description: "Health check for expired orders cron",
        responses: {
          "200": {
            description: "Cron is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/cron/expired-orders/trigger": {
      post: {
        tags: ["Cron"],
        summary: "Manual trigger",
        description: "Manually trigger expired orders processing",
        responses: {
          "200": {
            description: "Expired orders processed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CronResponse" },
              },
            },
          },
        },
      },
    },
    "/cron/update-currencies": {
      post: {
        tags: ["Cron"],
        summary: "Update currencies",
        description: "Internal cron endpoint to update currency exchange rates",
        responses: {
          "200": {
            description: "Currencies updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CurrencyUpdateResponse" },
              },
            },
          },
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
        description: "JWT token from Privy authentication",
      },
    },
    parameters: {
      LimitParam: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
        description: "Number of items to return",
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
      HealthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      CronResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          stats: {
            type: "object",
            properties: {
              totalExpired: { type: "integer" },
              updatedOrders: { type: "integer" },
              errors: { type: "integer" },
              processingTimeMs: { type: "integer" },
            },
          },
        },
      },
      CurrencyUpdateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          updated: { type: "array", items: { type: "string" } },
          errors: { type: "array", items: { type: "string" } },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      QuickStatsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              total_orders: { type: "integer" },
              total_revenue_usd: { type: "number" },
              pending_orders: { type: "integer" },
            },
          },
        },
      },

      // Merchant schemas
      MerchantProfile: {
        type: "object",
        description: "Merchant profile. Wallets are managed separately via /wallets endpoint.",
        properties: {
          merchant_id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          display_name: { type: "string" },
          description: { type: "string" },
          logo_url: { type: "string", format: "uri" },
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
          data: {
            type: "object",
            properties: {
              merchant_id: { type: "string", format: "uuid" },
              privy_did: { type: "string" },
              email: { type: "string", format: "email" },
              display_name: { type: "string" },
              description: { type: "string" },
              logo_url: { type: "string", format: "uri" },
              default_token_id: { type: "string" },
              default_currency: { type: "string" },
              default_language: { type: "string" },
              status: { type: "string", enum: ["ACTIVE", "INACTIVE", "PIN_BLOCKED"] },
              has_pin: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
              primary_wallet: {
                type: "object",
                nullable: true,
                description: "Primary EVM wallet for the merchant",
                properties: {
                  wallet_id: { type: "string", format: "uuid" },
                  address: { type: "string" },
                  chain_id: { type: "string" },
                  label: { type: "string", nullable: true },
                  source: { type: "string" },
                  is_primary: { type: "boolean" },
                  is_verified: { type: "boolean" },
                },
              },
            },
          },
          is_new: { type: "boolean", description: "Whether merchant was newly created (on POST)" },
          message: { type: "string" },
        },
      },
      MerchantStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              status: { type: "string" },
              has_pin: { type: "boolean" },
              pin_attempts: { type: "integer" },
              pin_blocked_at: { type: "string", format: "date-time", nullable: true },
            },
          },
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
        description: "Update merchant profile. Wallets are managed via /wallets endpoint.",
        properties: {
          email: { type: "string", format: "email" },
          display_name: { type: "string" },
          logo: { type: "string", description: "Base64 encoded image" },
          default_token_id: { type: "string" },
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
          code: { type: "string" },
        },
      },
      PinValidationResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              valid: { type: "boolean" },
              attempts_remaining: { type: "integer" },
              is_blocked: { type: "boolean" },
            },
          },
          message: { type: "string" },
        },
      },

      // Chain schemas
      Chain: {
        type: "object",
        properties: {
          chain_id: { type: "string", example: "8453" },
          name: { type: "string", example: "Base" },
          chain_type: { type: "string", enum: ["evm", "stellar", "solana"] },
          icon_url: { type: "string", format: "uri", nullable: true },
          explorer_url: { type: "string", format: "uri", nullable: true },
          is_active: { type: "boolean" },
        },
      },
      ChainListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Chain" } },
        },
      },

      // Wallet schemas
      Wallet: {
        type: "object",
        properties: {
          wallet_id: { type: "string", format: "uuid" },
          merchant_id: { type: "string", format: "uuid" },
          chain_id: { type: "string" },
          address: { type: "string" },
          label: { type: "string", nullable: true },
          source: { type: "string", enum: ["privy", "manual"] },
          external_wallet_id: { type: "string", nullable: true, description: "External wallet ID from provider (e.g., Privy)" },
          is_primary: { type: "boolean" },
          is_verified: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          chain: { $ref: "#/components/schemas/Chain" },
        },
      },
      WalletListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Wallet" } },
        },
      },
      WalletResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Wallet" },
          message: { type: "string" },
        },
      },
      WalletSyncResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Wallet" },
          message: { type: "string" },
        },
      },
      WalletPrimaryResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Wallet" },
          message: { type: "string" },
        },
      },
      AddWalletRequest: {
        type: "object",
        required: ["chain_id", "address"],
        properties: {
          chain_id: { type: "string" },
          address: { type: "string" },
          label: { type: "string" },
          source: { type: "string", enum: ["privy", "manual"], default: "manual" },
          is_primary: { type: "boolean" },
        },
      },
      UpdateWalletRequest: {
        type: "object",
        properties: {
          label: { type: "string" },
          is_primary: { type: "boolean" },
        },
      },
      WalletBalanceResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              wallet_id: { type: "string", format: "uuid", description: "Wallet UUID from wallets table" },
              address: { type: "string", description: "Wallet address" },
              chain_id: { type: "string", description: "Chain ID" },
              token: {
                type: "object",
                nullable: true,
                description: "Token info if token_id was provided",
                properties: {
                  token_name: { type: "string" },
                  token_address: { type: "string" },
                },
              },
              asset: { type: "string", description: "Asset name used for balance lookup (e.g., usdc, eth)" },
              balances: {
                type: "array",
                description: "Balance data from Privy API",
                items: {
                  type: "object",
                  properties: {
                    chain: { type: "string" },
                    asset: { type: "string" },
                    raw_value: { type: "string" },
                    raw_value_decimals: { type: "integer" },
                    display_values: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },

      // Transfer schemas
      EVMTransferRequest: {
        type: "object",
        required: ["walletId", "recipientAddress", "amount", "signature"],
        properties: {
          walletId: { type: "string", description: "Privy wallet ID" },
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
          data: {
            type: "object",
            properties: {
              transaction: {
                type: "object",
                properties: {
                  hash: { type: "string" },
                  caip2: { type: "string" },
                  walletId: { type: "string" },
                },
              },
              walletId: { type: "string" },
              recipientAddress: { type: "string" },
              amount: { type: "number" },
            },
          },
          message: { type: "string" },
        },
      },
      StellarTrustlineRequest: {
        type: "object",
        required: ["walletId"],
        properties: {
          walletId: { type: "string", description: "Privy wallet ID" },
        },
      },
      StellarTrustlineResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              result: {
                type: "object",
                properties: {
                  hash: { type: "string" },
                  ledger: { type: "integer" },
                },
              },
              already_exists: { type: "boolean" },
            },
          },
          message: { type: "string" },
        },
      },
      StellarTransferRequest: {
        type: "object",
        required: ["walletId", "destinationAddress", "amount"],
        properties: {
          walletId: { type: "string", description: "Privy wallet ID" },
          destinationAddress: { type: "string", description: "Stellar address (G...)" },
          amount: { type: "string", example: "10.5" },
        },
      },
      StellarTransferResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              result: {
                type: "object",
                properties: {
                  hash: { type: "string" },
                  ledger: { type: "integer" },
                },
              },
            },
          },
          message: { type: "string" },
        },
      },

      // Order schemas
      Order: {
        type: "object",
        properties: {
          order_id: { type: "string", format: "uuid" },
          number: { type: "string" },
          merchant_id: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "DISCREPANCY"] },
          display_amount: { type: "number" },
          display_currency: { type: "string" },
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
          pagination: {
            type: "object",
            properties: {
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      OrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            allOf: [
              { $ref: "#/components/schemas/Order" },
              {
                type: "object",
                properties: {
                  qrcode: { type: "string", description: "QR code URL for payment" },
                },
              },
            ],
          },
        },
      },
      CreateOrderRequest: {
        type: "object",
        required: ["display_amount", "display_currency"],
        properties: {
          display_amount: { type: "number", minimum: 0.1 },
          display_currency: { type: "string" },
          preferred_token_id: { type: "string" },
          description: { type: "string" },
          redirect_uri: { type: "string", format: "uri" },
        },
      },
      CreateOrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              payment_detail: { type: "object", description: "Daimo payment details" },
              order_id: { type: "string", format: "uuid" },
              order_number: { type: "string", nullable: true },
              expired_at: { type: "string", format: "date-time" },
              qrcode: { type: "string", description: "QR code URL for payment" },
            },
          },
          message: { type: "string" },
        },
      },
      RegeneratePaymentRequest: {
        type: "object",
        properties: {
          preferred_token_id: { type: "string" },
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
          pagination: {
            type: "object",
            properties: {
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      DepositResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            allOf: [
              { $ref: "#/components/schemas/Deposit" },
              {
                type: "object",
                properties: {
                  qrcode: { type: "string", description: "QR code URL for payment" },
                },
              },
            ],
          },
        },
      },
      CreateDepositRequest: {
        type: "object",
        required: ["display_amount", "display_currency"],
        properties: {
          display_amount: { type: "number", minimum: 0.1 },
          display_currency: { type: "string" },
          redirect_uri: { type: "string", format: "uri" },
        },
      },
      CreateDepositResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              deposit_id: { type: "string", format: "uuid" },
              qrcode: { type: "string", description: "QR code URL for payment" },
            },
          },
          message: { type: "string" },
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
          pagination: {
            type: "object",
            properties: {
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
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
          recipient: { type: "string" },
          amount: { type: "number", minimum: 0 },
          currency: { type: "string" },
        },
      },

      // Device schemas
      Device: {
        type: "object",
        properties: {
          device_id: { type: "string" },
          merchant_id: { type: "string", format: "uuid" },
          fcm_token: { type: "string" },
          platform: { type: "string", enum: ["ios", "android"] },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      DeviceResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/Device" },
          message: { type: "string" },
        },
      },
      RegisterDeviceRequest: {
        type: "object",
        required: ["device_id", "fcm_token", "platform"],
        properties: {
          device_id: { type: "string" },
          fcm_token: { type: "string" },
          platform: { type: "string", enum: ["ios", "android"] },
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
                  total_display_amounts: { type: "object" },
                },
              },
              charts: { type: "object" },
            },
          },
        },
      },
    },
  },
};
