/**
 * Deposits Function
 * Handles deposit creation and listing
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";

// Config
import { corsConfig, CONSTANTS } from "../../_shared/config/index.ts";

// Middleware
import {
  dualAuthMiddleware,
  errorMiddleware,
  notFoundHandler,
} from "../../_shared/middleware/index.ts";

// Services
import {
  validateMerchant,
  resolvePreferredToken,
  getDestinationAddress,
} from "../../_shared/services/merchant.service.ts";
import { convertCurrencyToUSD } from "../../_shared/services/currency.service.ts";
import { createDepositPaymentLink } from "../../_shared/services/payment.service.ts";

// Utils
import { generateOrderNumber } from "../../_shared/utils/helpers.ts";

// Validators
import {
  validatePaginationParams,
  validateStatusFilter,
} from "../../_shared/validators/common.validator.ts";
import { validateCreateDepositRequest } from "../../_shared/validators/order.validator.ts";

const app = new Hono().basePath("/deposits");

// Apply middleware
app.use("*", cors(corsConfig));
app.use("*", errorMiddleware);
app.use("*", dualAuthMiddleware);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create deposit
 */
async function createDeposit(
  supabase: any,
  userProviderId: string,
  isPrivyAuth: boolean,
  depositData: {
    display_currency: string;
    display_amount: number;
    redirect_uri?: string;
  },
) {
  // Step 1: Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    return merchantResult;
  }

  // Step 2: Convert currency to USD
  const conversionResult = await convertCurrencyToUSD(
    supabase,
    depositData.display_currency,
    depositData.display_amount,
  );
  if (!conversionResult.success || !conversionResult.usdAmount) {
    return conversionResult;
  }

  // Step 3: Resolve default token
  const tokenResult = await resolvePreferredToken(
    supabase,
    merchantResult.merchant.default_token_id,
  );
  if (!tokenResult.success || !tokenResult.token) {
    return tokenResult;
  }

  // Step 4: Generate deposit number
  const depositNumber = generateOrderNumber();

  // Step 5: Create payment link
  const paymentResult = await createDepositPaymentLink(
    merchantResult.merchant,
    depositData,
    depositNumber,
    conversionResult.usdAmount,
    tokenResult.token,
  );
  if (!paymentResult.success || !paymentResult.paymentDetail) {
    return paymentResult;
  }

  // Step 6: Insert deposit record
  const destinationAddress = getDestinationAddress(merchantResult.merchant);
  if (!destinationAddress) {
    return { success: false, error: "Destination address not found" };
  }

  const now = new Date().toISOString();
  const depositToInsert = {
    merchant_id: merchantResult.merchant.merchant_id,
    payment_id: paymentResult.paymentDetail.id,
    merchant_chain_id: tokenResult.token.chain_id,
    merchant_address: destinationAddress,
    required_amount_usd: conversionResult.usdAmount,
    required_token: tokenResult.token.token_address,
    display_amount: depositData.display_amount,
    display_currency: depositData.display_currency,
    status: CONSTANTS.STATUS.PAYMENT.PENDING,
    created_at: now,
    updated_at: now,
    number: depositNumber,
  };

  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .insert(depositToInsert)
    .select()
    .single();

  if (depositError) {
    return { success: false, error: depositError.message };
  }

  return {
    success: true,
    paymentDetail: paymentResult.paymentDetail,
    deposit_id: deposit.deposit_id,
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /deposits - Get all deposits for merchant
 */
app.get("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Parse query parameters
  const url = new URL(c.req.url);
  const paginationResult = validatePaginationParams(
    url.searchParams.get("limit"),
    url.searchParams.get("offset"),
  );
  if (!paginationResult.success) {
    return c.json({ success: false, error: paginationResult.error }, 400);
  }

  const statusResult = validateStatusFilter(url.searchParams.get("status"));
  if (!statusResult.success) {
    return c.json({ success: false, error: statusResult.error }, 400);
  }

  const { limit, offset } = paginationResult;

  // Build query
  const applyStatusFilter = (query: any) => {
    if (!statusResult.status) return query;
    if (statusResult.status === "PENDING") {
      return query.in("status", ["PENDING", "PROCESSING"]);
    }
    return query.eq("status", statusResult.status);
  };

  // Execute queries in parallel
  const [countResult, depositsResult] = await Promise.all([
    applyStatusFilter(
      supabase
        .from("deposits")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchantResult.merchant.merchant_id),
    ),
    applyStatusFilter(
      supabase
        .from("deposits")
        .select("*")
        .eq("merchant_id", merchantResult.merchant.merchant_id),
    )
      .order("created_at", { ascending: false })
      .range(offset!, offset! + limit! - 1),
  ]);

  const { count: totalCount } = countResult;
  const { data: deposits, error } = depositsResult;

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  return c.json({
    success: true,
    deposits: deposits || [],
    total: totalCount || 0,
    offset,
    limit,
  });
});

/**
 * GET /deposits/:depositId - Get single deposit
 */
app.get("/:depositId", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");
  const depositId = c.req.param("depositId");

  // Validate merchant
  const merchantResult = await validateMerchant(
    supabase,
    userProviderId,
    isPrivyAuth,
  );
  if (!merchantResult.success || !merchantResult.merchant) {
    const status = merchantResult.code ? 403 : 404;
    return c.json(
      { success: false, error: merchantResult.error, code: merchantResult.code },
      status,
    );
  }

  // Get deposit
  const { data: deposit, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("deposit_id", depositId)
    .eq("merchant_id", merchantResult.merchant.merchant_id)
    .single();

  if (error || !deposit) {
    return c.json({ success: false, error: "Deposit not found" }, 404);
  }

  const intentPayUrl = Deno.env.get("ROZO_PAY_URL");
  if (!intentPayUrl) {
    return c.json({ success: false, error: "ROZO_PAY_URL is not set" }, 500);
  }

  return c.json({
    success: true,
    deposit: {
      ...deposit,
      qrcode: `${intentPayUrl}${deposit.payment_id}`,
    },
  });
});

/**
 * POST /deposits - Create new deposit
 */
app.post("/", async (c) => {
  const supabase = c.get("supabase");
  const userProviderId = c.get("dynamicId");
  const isPrivyAuth = c.get("isPrivyAuth");

  // Parse and validate request
  const body = await c.req.json();
  const validation = validateCreateDepositRequest(body);
  if (!validation.success || !validation.data) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Create deposit
  const result = await createDeposit(
    supabase,
    userProviderId,
    isPrivyAuth,
    validation.data,
  );

  if (!result.success || !result.paymentDetail) {
    const status = result.code ? 403 : 400;
    return c.json(
      { success: false, error: result.error, code: result.code },
      status,
    );
  }

  const intentPayUrl = Deno.env.get("ROZO_PAY_URL");
  if (!intentPayUrl) {
    return c.json({ success: false, error: "ROZO_PAY_URL is not set" }, 500);
  }

  return c.json(
    {
      success: true,
      qrcode: `${intentPayUrl}${result.paymentDetail.id}`,
      deposit_id: result.deposit_id,
      message: "Deposit created successfully",
    },
    201,
  );
});

// Not found handler
app.notFound(notFoundHandler);

// Export for Deno
Deno.serve(app.fetch);
