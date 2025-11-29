# System Architecture

This document covers the technical architecture, project structure, and core functions of the Rozo Backend API.

## Tech Stack

- **Database**: PostgreSQL (Supabase)
- **Compute**: Supabase Edge Functions (Deno Runtime, TypeScript)
- **Authentication**: [Privy](https://privy.io/) (Wallet authentication and user management)
- **Web Framework**: [Hono](https://hono.dev/) (for all Edge Functions)
- **Payments**: [Daimo Pay](https://pay.daimo.com/) (Payment processing and webhooks)
- **Real-time Notifications**: [Pusher](https://pusher.com/) (For instant updates on payment status)
- **Caching**: In-memory currency rate caching with TTL
- **Cron Jobs**: Automated order expiration and currency updates

## Project Structure

```text
├── docs/                   # Documentation
│   ├── architecture.md    # This file
│   ├── merchant-status.md # Merchant and PIN system
│   ├── order-system.md    # Order lifecycle and status
│   ├── performance.md     # Caching and monitoring
│   ├── development.md     # Development guidelines
│   └── deployment.md      # Setup and deployment
├── example.env            # Environment variable template
├── supabase/
│   ├── _shared/           # Shared utilities and middleware
│   │   ├── config/        # Constants, CORS configuration
│   │   ├── middleware/    # Auth, error handling, PIN validation
│   │   ├── services/      # Business logic services (merchant, payment, currency, wallet)
│   │   ├── utils/         # Common utility functions
│   │   ├── types/         # TypeScript interfaces
│   │   ├── schemas/       # Zod validation schemas
│   │   └── factories/     # Transaction factory
│   ├── functions/         # Core application logic as Edge Functions
│   │   ├── profile/       # Merchant profile and PIN management
│   │   │   ├── index.ts   # Main entry point
│   │   │   └── deno.json  # Deno configuration
│   │   ├── wallets/       # Multi-chain wallet management
│   │   │   ├── index.ts   # Main entry point
│   │   │   └── deno.json  # Deno configuration
│   │   ├── transfers/     # EVM and Stellar transfers
│   │   │   ├── index.ts   # Main entry point
│   │   │   ├── transfer.ts # Stellar transfer logic
│   │   │   ├── trustline.ts # Stellar trustline logic
│   │   │   └── deno.json  # Deno configuration
│   │   ├── orders/        # Order lifecycle management
│   │   │   ├── index.ts   # Main entry point
│   │   │   └── deno.json  # Deno configuration
│   │   ├── deposits/      # Deposit management (Hono-based)
│   │   │   ├── index.ts   # Main entry point
│   │   │   └── deno.json  # Deno configuration
│   │   ├── withdrawals/   # Merchant withdrawal processing
│   │   │   ├── index.ts   # Main entry point
│   │   │   └── deno.json  # Deno configuration
│   │   ├── payment-callback/  # Payment webhook processing
│   │   │   ├── index.ts   # Webhook handler (no auth required)
│   │   │   ├── pusher.ts  # Pusher notifications integration
│   │   │   └── deno.json  # Deno configuration
│   │   ├── cron/          # Consolidated cron jobs
│   │   │   ├── index.ts   # Expired orders + currency updates
│   │   │   └── deno.json  # Deno configuration
│   ├── migrations/        # Database schema migrations (16 files)
│   │   ├── 20250618174036_initial_setup.sql
│   │   ├── 20250621085630_withdrawals.sql
│   │   ├── 20250623074412_order_number.sql
│   │   ├── 20250630142432_deposits.sql
│   │   ├── 20250914172526_remote_schema.sql
│   │   ├── 20250914172728_add_privy_id.sql
│   │   ├── 20251020111110_add_merchant_pincode_status.sql
│   │   ├── 20251022120000_add_orders_expired_payment_data.sql
│   │   ├── 20251023000000_add_preferred_token_id_to_orders.sql
│   │   ├── 20251031000000_create_merchant_devices.sql
│   │   ├── 20251101133527_add_stellar_wallet.sql
│   │   ├── 20251127000000_add_performance_indexes.sql
│   │   ├── 20251127072630_remote_schema.sql
│   │   ├── 20251127132819_restore_audit_logs.sql
│   │   ├── 20251127153804_wallet_management_restructure.sql
│   │   └── 20251128000000_remove_dynamic_auth.sql
│   └── seed.sql           # Initial data for development
```

## Supabase Edge Functions

Core backend logic is handled by these Supabase Edge Functions:

### 1. `/profile`

- **Manages**: Merchant profiles (create, read, update) and PIN management
- **Auth**: Privy JWT
- **Features**: Profile management, logo upload, merchant settings, PIN operations
- **Database**: Uses `privy_id` column for merchant identification
- **Endpoints**:
  - `GET /profile` - Get merchant profile
  - `POST /profile` - Create merchant profile
  - `PUT /profile` - Update merchant profile
  - `GET /profile/status` - Check profile and PIN status
  - `POST /profile/pin` - Set PIN
  - `PUT /profile/pin` - Update PIN
  - `DELETE /profile/pin` - Revoke PIN
  - `POST /profile/pin/validate` - Validate PIN

### 2. `/wallets`

- **Manages**: Multi-chain wallet management
- **Auth**: Privy JWT
- **Features**: Wallet CRUD, chain listing, Privy wallet sync
- **Endpoints**:
  - `GET /wallets` - List merchant's wallets
  - `POST /wallets` - Add new wallet
  - `GET /wallets/chains` - List supported blockchain networks
  - `POST /wallets/sync` - Sync Privy embedded wallet
  - `GET /wallets/{walletId}` - Get wallet details
  - `PUT /wallets/{walletId}` - Update wallet (label)
  - `DELETE /wallets/{walletId}` - Remove wallet
  - `PUT /wallets/{walletId}/primary` - Set wallet as primary for its chain

### 3. `/transfers`

- **Manages**: Multi-chain wallet transfers and operations
- **Auth**: Privy JWT + PIN validation
- **Features**:
  - EVM transfers (USDC on Base)
  - Stellar trustline setup
  - Stellar USDC transfers
  - Transaction caching to prevent duplicates
- **Endpoints**:
  - `POST /transfers/evm` - EVM chain transfer
  - `POST /transfers/stellar` - Stellar transfer
  - `POST /transfers/stellar/trustline` - Enable USDC trustline

### 4. `/orders`

- **Manages**: Order lifecycle (creation, retrieval, status tracking, payment regeneration)
- **Auth**: Privy JWT
- **Features**:
  - Order creation with cached currency conversion
  - Preferred token system (user choice vs merchant default)
  - Payment regeneration with optional token changes
  - Automatic expiration (10 minutes from creation)
  - Pagination and status filtering
  - Performance monitoring and metrics
- **Database Fields**: `expired_at`, `payment_data` (jsonb), `preferred_token_id`
- **Endpoints**:
  - `POST /orders` - Create new order
  - `GET /orders` - List orders with pagination
  - `GET /orders/{id}` - Get single order
  - `POST /orders/{id}/regenerate-payment` - Regenerate payment link
- **Integrates with**: Daimo Pay for payment processing, currency cache, tokens table

### 5. `/deposits`

- **Framework**: Built with Hono for modern routing and middleware
- **Manages**: Merchant deposit requests and tracking
- **Auth**: Privy JWT
- **Features**: Deposit creation, history retrieval, status tracking
- **Integrates with**: Daimo Pay for payment processing

### 6. `/withdrawals`

- **Manages**: Merchant withdrawal requests and processing
- **Auth**: Privy JWT + PIN validation
- **Features**: Withdrawal creation, history retrieval

### 7. `/payment-callback`

- **Handles**: Incoming webhooks from Daimo Pay
- **Actions**: Updates order/deposit status, validates payment data
- **Auth**: Webhook secret authentication
- **Features**: Status transition validation, duplicate webhook handling
- **Integrates with**: Pusher for real-time notifications

### 8. `/cron`

- **Type**: Consolidated cron job function
- **Manages**: Expired orders processing and currency rate updates
- **Features**:
  - Updates expired PENDING orders to EXPIRED status
  - Handles orders with and without `expired_at` field
  - Fetches rates from ExchangeRate-API, updates database
  - Performance monitoring and statistics
- **Endpoints**:
  - `POST /cron/expired-orders` - Process expired orders
  - `GET /cron/expired-orders/health` - Health check
  - `POST /cron/expired-orders/trigger` - Manual trigger for testing
  - `POST /cron/update-currencies` - Update currency rates

### 9. `/devices`

- **Manages**: Push notification device registration
- **Auth**: Privy JWT
- **Features**: FCM token management, device registration/unregistration
- **Endpoints**:
  - `POST /devices` - Register device with FCM token
  - `DELETE /devices/:deviceId` - Unregister device

### 10. `/reports`

- **Manages**: Dashboard analytics and reporting
- **Auth**: Privy JWT
- **Features**: Transaction summaries, time-series data, currency breakdowns
- **Endpoints**:
  - `GET /reports/summary` - Dashboard report with date range and grouping

### 11. `/api-docs`

- **Manages**: OpenAPI/Swagger documentation
- **Auth**: Public (no authentication)
- **Features**: Interactive API documentation

## Authentication Architecture

The system uses Privy for authentication:

### Privy Authentication

- Modern wallet authentication and user management
- Uses `privy_id` column in merchants table (required, unique)
- Embedded wallet support via Privy SDK
- JWT tokens verified server-side using Privy server SDK

### Implementation Pattern

All functions (except webhooks) follow this pattern:

1. Extract Bearer token from Authorization header
2. Verify JWT via Privy SDK
3. Extract `privyId` and `walletAddress` from verified token
4. Query merchant by `privy_id`
5. Execute business logic with authenticated merchant context

## Database Schema

### Core Tables

- **merchants**: Merchant profiles identified by Privy ID
- **orders**: Order lifecycle with expiration and payment data
- **deposits**: Merchant deposit requests
- **withdrawals**: Merchant withdrawal processing
- **currencies**: Exchange rates for currency conversion
- **tokens**: Supported payment tokens linked to chains
- **chains**: Supported blockchain networks (EVM, Stellar, Solana)
- **merchant_wallets**: Merchant wallet addresses per chain with primary designation

### Key Relationships

- Merchants can have multiple orders, deposits, and withdrawals
- Merchants can have multiple wallets across different chains
- Each chain can have one primary wallet per merchant
- Tokens link to chains via `chain_id` (determines which wallet to use)
- Orders link to merchants via `merchant_id`
- Orders include payment data and expiration timestamps
- Currency conversion uses cached rates from currencies table
- Transaction destination address determined by `default_token_id` → chain → primary wallet

## Performance Architecture

- **Currency Caching**: In-memory cache with 5-minute TTL
- **Database Indexes**: Optimized queries for status and expiration
- **Parallel Processing**: Concurrent operations where possible
- **Monitoring**: Performance metrics and error tracking
- **Cron Jobs**: Automated cleanup and maintenance tasks

## Security Architecture

- **Privy Authentication**: Secure JWT-based authentication with embedded wallets
- **PIN Code System**: Additional security layer for sensitive operations (withdrawals, transfers)
- **Status Management**: Account status enforcement across all functions
- **Webhook Validation**: Secure payment callback processing
- **Input Validation**: Comprehensive data validation using Zod schemas
