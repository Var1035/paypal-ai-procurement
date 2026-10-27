import { env } from "../config/env.js";
import { supabase } from "./supabase.js";

/**
 * PayPal API Service for B2B Escrow & Payment Capture
 * Connects directly to PayPal REST API v2 using OAuth2 Client Credentials
 */

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpiryTime = 0;

/**
 * Get OAuth2 Access Token from PayPal
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  const apiBase = env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment");
  }

  // Return cached token if valid
  if (cachedToken && Date.now() < tokenExpiryTime - 60000) {
    return cachedToken;
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal OAuth failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as PayPalTokenResponse;
  cachedToken = data.access_token;
  tokenExpiryTime = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Test connectivity with configured PayPal credentials
 */
export async function testPayPalConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      return {
        ok: false,
        message: "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment",
      };
    }

    const token = await getPayPalAccessToken();
    return {
      ok: !!token,
      message: `Successfully authenticated with PayPal (${env.PAYPAL_API_BASE.includes("sandbox") ? "Sandbox" : "Live"})`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Failed to authenticate with PayPal",
    };
  }
}

/**
 * Create a PayPal Order (Intent: CAPTURE)
 */
export async function createPayPalOrder(params: {
  orderId?: string;
  quotationId?: string;
  amount: number;
  currency?: string;
  title: string;
}): Promise<{
  id: string;
  status: string;
  approvalUrl?: string;
}> {
  const apiBase = env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
  const token = await getPayPalAccessToken();

  const currency = params.currency || "USD";
  // Format amount to 2 decimal places string
  const formattedAmount = params.amount.toFixed(2);

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.orderId || params.quotationId || `PO-${Date.now()}`,
        description: params.title.slice(0, 127),
        amount: {
          currency_code: currency,
          value: formattedAmount,
        },
      },
    ],
    application_context: {
      brand_name: "AgentMarket B2B Payments",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: `${env.CLIENT_URL}/sourcing?paypal_status=success`,
      cancel_url: `${env.CLIENT_URL}/sourcing?paypal_status=cancelled`,
    },
  };

  const response = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal create order failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const approvalUrl = data.links?.find((l: any) => l.rel === "approve")?.href;

  return {
    id: data.id,
    status: data.status,
    approvalUrl,
  };
}

/**
 * Capture payment for an approved PayPal Order
 */
export async function capturePayPalOrder(params: {
  paypalOrderId: string;
  orderId?: string;
}): Promise<{
  success: boolean;
  captureId?: string;
  status: string;
  paymentRecordId?: string;
}> {
  const apiBase = env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
  const token = await getPayPalAccessToken();

  const response = await fetch(`${apiBase}/v2/checkout/orders/${params.paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal capture order failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const captureId = capture?.id || data.id;
  const status = data.status || "COMPLETED";

  let paymentRecordId: string | undefined;

  // Record payment in Supabase if connected
  if (supabase) {
    const amountVal = parseFloat(capture?.amount?.value || "0");
    const currencyVal = capture?.amount?.currency_code || "USD";

    const { data: inserted, error: payErr } = await supabase
      .from("payments")
      .insert({
        order_id: params.orderId || null,
        paypal_order_id: params.paypalOrderId,
        paypal_capture_id: captureId,
        amount: amountVal,
        currency: currencyVal,
        status: "COMPLETED",
        verified_at: new Date().toISOString(),
        raw_response: data,
      })
      .select("id")
      .single();

    if (!payErr && inserted) {
      paymentRecordId = inserted.id;
    }

    // Update order stage if orderId was provided
    if (params.orderId) {
      await supabase
        .from("orders")
        .update({
          stage: "In production",
          health: "On Track",
        })
        .eq("id", params.orderId);
    }
  }

  return {
    success: true,
    captureId,
    status,
    paymentRecordId,
  };
}
