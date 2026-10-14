type MpesaEnv = {
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_SHORTCODE?: string;
  MPESA_PARTY_B?: string;
  MPESA_PASSKEY?: string;
  MPESA_CALLBACK_URL?: string;
  MPESA_TRANSACTION_TYPE?: string;
  APP_URL?: string;
  MPESA_ENV?: string;
};

type StkPushInput = {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
};

type StkPushResponse = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
};

import { normalizeMpesaPhone } from "./mpesa-phone.ts";
export { normalizeMpesaPhone } from "./mpesa-phone.ts";

function providerMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Record<string, unknown>;
  for (const key of [
    "errorMessage",
    "error_description",
    "ResponseDescription",
    "CustomerMessage",
  ]) {
    const message = response[key];
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

function setting(env: unknown, key: keyof MpesaEnv): string | undefined {
  const runtime = env && typeof env === "object" ? (env as MpesaEnv)[key] : undefined;
  const value = runtime ?? (typeof process !== "undefined" ? process.env[key] : undefined);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function configuration(env: unknown) {
  const consumerKey = setting(env, "MPESA_CONSUMER_KEY");
  const consumerSecret = setting(env, "MPESA_CONSUMER_SECRET");
  const shortcode = setting(env, "MPESA_SHORTCODE");
  const partyB = setting(env, "MPESA_PARTY_B") ?? shortcode;
  const passkey = setting(env, "MPESA_PASSKEY");
  const appUrl = setting(env, "APP_URL");
  const callbackUrl =
    setting(env, "MPESA_CALLBACK_URL") ??
    (appUrl ? `${appUrl.replace(/\/+$/, "")}/api/mpesa/callback` : undefined);
  const transactionType = setting(env, "MPESA_TRANSACTION_TYPE") ?? "CustomerPayBillOnline";

  const missing = [
    !consumerKey && "MPESA_CONSUMER_KEY",
    !consumerSecret && "MPESA_CONSUMER_SECRET",
    !shortcode && "MPESA_SHORTCODE",
    !passkey && "MPESA_PASSKEY",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`M-Pesa production configuration is missing: ${missing.join(", ")}.`);
  }
  if (setting(env, "MPESA_ENV") !== "production") {
    throw new Error("Set MPESA_ENV=production to use Safaricom's live M-Pesa credentials.");
  }
  if (!partyB || !/^\d+$/.test(partyB)) {
    throw new Error("MPESA_PARTY_B must be a numeric Safaricom shortcode or Till number.");
  }
  if (!callbackUrl) throw new Error("Set APP_URL or MPESA_CALLBACK_URL for M-Pesa callbacks.");
  if (!["CustomerPayBillOnline", "CustomerBuyGoodsOnline"].includes(transactionType)) {
    throw new Error(
      "MPESA_TRANSACTION_TYPE must be CustomerPayBillOnline or CustomerBuyGoodsOnline.",
    );
  }
  let callback: URL;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new Error("The M-Pesa callback URL is invalid.");
  }
  if (callback.protocol !== "https:" || callback.username || callback.password) {
    throw new Error("The M-Pesa callback URL must be a public HTTPS URL.");
  }

  return { consumerKey, consumerSecret, shortcode, partyB, passkey, callbackUrl, transactionType };
}

function mpesaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

async function providerJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = providerMessage(payload);
    throw new Error(
      `Safaricom M-Pesa request failed (HTTP ${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Safaricom M-Pesa returned an invalid response.");
  }
  return payload as T;
}

export async function startStkPush(input: StkPushInput, env: unknown) {
  const config = configuration(env);
  if (!Number.isSafeInteger(input.amountKes) || input.amountKes < 1) {
    throw new Error("M-Pesa payment amount must be a positive whole number of Kenya shillings.");
  }
  const phone = normalizeMpesaPhone(input.phone);
  if (!phone) throw new Error("Add a valid Safaricom mobile number to your account before paying.");

  const token = await providerJson<{ access_token?: string }>(
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`,
      },
    },
  );
  if (!token.access_token)
    throw new Error("Safaricom M-Pesa authentication returned no access token.");

  const timestamp = mpesaTimestamp();
  const response = await providerJson<StkPushResponse>(
    "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString(
          "base64",
        ),
        Timestamp: timestamp,
        TransactionType: config.transactionType,
        Amount: input.amountKes,
        PartyA: phone,
        PartyB: config.partyB,
        PhoneNumber: phone,
        CallBackURL: config.callbackUrl,
        AccountReference: input.accountReference.slice(0, 12),
        TransactionDesc: input.transactionDesc.slice(0, 13),
      }),
    },
  );
  if (response.ResponseCode !== "0") {
    const detail = providerMessage(response);
    throw new Error(
      `Safaricom M-Pesa did not accept the STK push request${detail ? `: ${detail}` : ` (response code ${response.ResponseCode}).`}`,
    );
  }
  if (!response.CheckoutRequestID || !response.MerchantRequestID) {
    throw new Error("Safaricom M-Pesa accepted the STK push but returned incomplete request IDs.");
  }
  return {
    checkoutRequestId: response.CheckoutRequestID,
    merchantRequestId: response.MerchantRequestID,
  };
}
