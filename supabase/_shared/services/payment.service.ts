/**
 * Payment Service
 * Payment link creation and Daimo Pay integration
 */

import { CONSTANTS } from "../config/constants.ts";
import type {
  CreatePaymentLinkProps,
  DaimoPayment,
  DaimoPaymentResponse,
  MerchantData,
  TokenData,
} from "../types/common.types.ts";
// Note: Destination address is now resolved from wallets table
// and passed as a parameter to payment functions

/**
 * Create Daimo payment link
 */
export async function createDaimoPaymentLink(
  props: CreatePaymentLinkProps,
): Promise<DaimoPaymentResponse> {
  const {
    intent,
    destinationAddress,
    amountUnits,
    orderNumber,
    description,
    destinationToken,
    preferredToken,
    isOrder = true,
  } = props;

  const destinationChainId = Number(destinationToken.chain_id);
  const tokenAddress = destinationToken.token_address;

  try {
    // Get API key from environment variables
    const apiKey = Deno.env.get("DAIMO_API_KEY");
    if (!apiKey) {
      return {
        success: false,
        paymentDetail: null,
        error: "DAIMO_API_KEY environment variable is not set",
      };
    }

    // Validate required parameters
    if (
      !intent ||
      !destinationAddress ||
      !destinationChainId ||
      !tokenAddress ||
      !amountUnits
    ) {
      return {
        success: false,
        paymentDetail: null,
        error: "Missing required parameters for Creating paymentLink",
      };
    }

    // Validate amount format
    if (isNaN(parseFloat(amountUnits)) || parseFloat(amountUnits) <= 0) {
      return {
        success: false,
        paymentDetail: null,
        error: "amountUnits must be a valid positive number",
      };
    }

    // Get callback URL from configuration
    const callbackUrl = CONSTANTS.API.PAYMENT_CALLBACK_URL;

    // Construct payment request
    const paymentRequest = {
      appId: "rozoApp",
      display: {
        intent: intent || "Pay",
        paymentValue: String(parseFloat(amountUnits)),
        currency: "USD",
      },
      destination: {
        destinationAddress,
        chainId: String(destinationChainId),
        amountUnits: String(parseFloat(amountUnits)),
        tokenSymbol: destinationToken.token_name,
        tokenAddress: tokenAddress,
      },
      externalId: orderNumber || "",
      metadata: {
        orderNumber: orderNumber || "",
        intent: intent || "Pay",
        items: [
          {
            name: isOrder ? "Order Number" : "Deposit Number",
            description: orderNumber,
          },
          ...(description ? [{ name: "Note", description }] : []),
        ],
        payer: {},
        orderDate: new Date().toISOString(),
        merchantToken: destinationAddress || "",
        forMerchant: true,
        callbackUrl,
      },
      preferredChain: preferredToken.chain_id,
      preferredToken: preferredToken.token_name,
      preferredTokenAddress: preferredToken.token_address,
      callbackUrl,
    };

    // Make API request to Daimo Pay
    const response = await fetch(CONSTANTS.API.PAYMENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        paymentDetail: null,
        error: `Daimo API Error ${response.status}: ${errorText}`,
      };
    }

    const paymentDetail = (await response.json()) as DaimoPayment;
    return {
      success: true,
      paymentDetail,
    };
  } catch (error) {
    return {
      success: false,
      paymentDetail: null,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Create payment link for order
 * @param destinationAddress - The merchant's wallet address for this chain (from wallets table)
 */
export async function createOrderPaymentLink(
  _merchant: MerchantData,
  orderData: {
    display_currency: string;
    display_amount: number;
    description?: string;
    redirect_uri?: string;
    preferred_token_id?: string;
  },
  orderNumber: string,
  formattedUsdAmount: number,
  destinationToken: TokenData,
  preferredToken: TokenData,
  destinationAddress: string,
): Promise<{ success: boolean; paymentDetail?: DaimoPayment; error?: string }> {
  try {
    if (!destinationAddress) {
      return {
        success: false,
        error: "Destination address not found",
      };
    }

    const paymentResponse = await createDaimoPaymentLink({
      intent: CONSTANTS.DEFAULTS.INTENT_TITLE,
      destinationAddress,
      orderNumber: orderNumber,
      amountUnits: formattedUsdAmount.toString(),
      description: orderData.description,
      redirect_uri: orderData.redirect_uri,
      destinationToken,
      preferredToken,
      isOrder: true,
    });

    if (!paymentResponse.success || !paymentResponse.paymentDetail) {
      return {
        success: false,
        error: paymentResponse.error || "Payment detail is missing",
      };
    }

    return { success: true, paymentDetail: paymentResponse.paymentDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Payment link creation failed",
    };
  }
}

/**
 * Create payment link for deposit
 * @param destinationAddress - The merchant's wallet address for this chain (from wallets table)
 */
export async function createDepositPaymentLink(
  _merchant: MerchantData,
  depositData: {
    display_currency: string;
    display_amount: number;
    redirect_uri?: string;
  },
  depositNumber: string,
  formattedUsdAmount: number,
  token: TokenData,
  destinationAddress: string,
): Promise<{ success: boolean; paymentDetail?: DaimoPayment; error?: string }> {
  try {
    if (!destinationAddress) {
      return {
        success: false,
        error: "Destination address not found",
      };
    }

    const paymentResponse = await createDaimoPaymentLink({
      intent: "Deposit Payment",
      destinationAddress,
      orderNumber: depositNumber,
      amountUnits: formattedUsdAmount.toString(),
      redirect_uri: depositData.redirect_uri,
      destinationToken: token,
      preferredToken: token, // For deposits, both are the same
      isOrder: false,
    });

    if (!paymentResponse.success || !paymentResponse.paymentDetail) {
      return {
        success: false,
        error: paymentResponse.error || "Payment detail is missing",
      };
    }

    return { success: true, paymentDetail: paymentResponse.paymentDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Payment link creation failed",
    };
  }
}

/**
 * Get QR code URL for payment
 */
export function getPaymentQrCodeUrl(paymentId: string): string {
  const rozoPayUrl = CONSTANTS.API.ROZO_PAY_URL;
  return `${rozoPayUrl}${paymentId}`;
}
