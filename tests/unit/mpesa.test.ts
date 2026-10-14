import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMpesaPhone, startStkPush } from "../../src/lib/mpesa.ts";
import { isSafaricomMpesaPhone } from "../../src/lib/mpesa-phone.ts";

const productionEnv = {
  MPESA_ENV: "production",
  MPESA_CONSUMER_KEY: "consumer-key",
  MPESA_CONSUMER_SECRET: "consumer-secret",
  MPESA_SHORTCODE: "123456",
  MPESA_PASSKEY: "passkey",
  APP_URL: "https://example.co.ke",
};

test("normalizes supported Kenyan mobile number formats", () => {
  assert.equal(normalizeMpesaPhone("0712345678"), "254712345678");
  assert.equal(normalizeMpesaPhone("+254 712 345 678"), "254712345678");
  assert.equal(normalizeMpesaPhone("0112345678"), "254112345678");
  assert.equal(normalizeMpesaPhone("0732123456"), null);
  assert.equal(normalizeMpesaPhone("0782123456"), null);
  assert.equal(normalizeMpesaPhone("071234567"), null);
  assert.equal(normalizeMpesaPhone("0201234567"), null);
});

test("validates Safaricom phone numbers in exact international format", () => {
  assert.equal(isSafaricomMpesaPhone("254743574820"), true);
  assert.equal(isSafaricomMpesaPhone("0743574820"), false);
  assert.equal(isSafaricomMpesaPhone("+254743574820"), false);
  assert.equal(isSafaricomMpesaPhone("254 743 574 820"), false);
  assert.equal(isSafaricomMpesaPhone("254735748200"), false);
});

test("identifies missing production M-Pesa settings without exposing secrets", async () => {
  await assert.rejects(
    startStkPush(
      {
        phone: "0712345678",
        amountKes: 400,
        accountReference: "ELM123456",
        transactionDesc: "Mathematics class",
      },
      { ...productionEnv, MPESA_PASSKEY: undefined, MPESA_CONSUMER_SECRET: undefined },
    ),
    /MPESA_CONSUMER_SECRET, MPESA_PASSKEY/,
  );
});

test("sends a production STK push with the registered HTTPS callback", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return requests.length === 1
      ? Response.json({ access_token: "access-token" })
      : Response.json({
          ResponseCode: "0",
          CheckoutRequestID: "checkout-id",
          MerchantRequestID: "merchant-id",
        });
  };

  try {
    const result = await startStkPush(
      {
        phone: "0712345678",
        amountKes: 400,
        accountReference: "ELM123456",
        transactionDesc: "Mathematics class",
      },
      productionEnv,
    );

    assert.equal(result.checkoutRequestId, "checkout-id");
    assert.equal(result.merchantRequestId, "merchant-id");
    assert.equal(
      requests[0].url,
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    );
    assert.equal(requests[1].url, "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    assert.equal(
      requests[0].init.headers && new Headers(requests[0].init.headers).get("authorization"),
      `Basic ${Buffer.from("consumer-key:consumer-secret").toString("base64")}`,
    );
    assert.equal(
      requests[1].init.headers && new Headers(requests[1].init.headers).get("authorization"),
      "Bearer access-token",
    );

    const payload = JSON.parse(String(requests[1].init.body));
    assert.equal(payload.BusinessShortCode, "123456");
    assert.equal(payload.TransactionType, "CustomerPayBillOnline");
    assert.equal(payload.Amount, 400);
    assert.equal(payload.PartyA, "254712345678");
    assert.equal(payload.PhoneNumber, "254712345678");
    assert.equal(payload.CallBackURL, "https://example.co.ke/api/mpesa/callback");
    assert.equal(
      Buffer.from(payload.Password, "base64").toString(),
      `123456passkey${payload.Timestamp}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sends Merchant Till STK requests with the configured Till as PartyB", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return requests.length === 1
      ? Response.json({ access_token: "access-token" })
      : Response.json({
          ResponseCode: "0",
          CheckoutRequestID: "checkout-id",
          MerchantRequestID: "merchant-id",
        });
  };

  try {
    await startStkPush(
      {
        phone: "254712345678",
        amountKes: 100,
        accountReference: "ELM123456",
        transactionDesc: "Mathematics class",
      },
      {
        ...productionEnv,
        MPESA_SHORTCODE: "1322739",
        MPESA_PARTY_B: "1792746",
        MPESA_TRANSACTION_TYPE: "CustomerBuyGoodsOnline",
      },
    );

    const payload = JSON.parse(String(requests[1].init.body));
    assert.equal(payload.BusinessShortCode, "1322739");
    assert.equal(payload.PartyB, "1792746");
    assert.equal(payload.TransactionType, "CustomerBuyGoodsOnline");
    assert.equal(
      Buffer.from(payload.Password, "base64").toString(),
      `1322739passkey${payload.Timestamp}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects non-HTTPS callback URLs before contacting Safaricom", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Safaricom must not be called for an invalid callback URL.");
  };
  try {
    await assert.rejects(
      startStkPush(
        {
          phone: "0712345678",
          amountKes: 400,
          accountReference: "ELM123456",
          transactionDesc: "Mathematics class",
        },
        { ...productionEnv, APP_URL: "http://example.co.ke" },
      ),
      /public HTTPS URL/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requires an explicit production environment before contacting Safaricom", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Safaricom must not be called without explicit production mode.");
  };
  try {
    await assert.rejects(
      startStkPush(
        {
          phone: "0712345678",
          amountKes: 400,
          accountReference: "ELM123456",
          transactionDesc: "Mathematics class",
        },
        { ...productionEnv, MPESA_ENV: undefined },
      ),
      /MPESA_ENV=production/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("includes Safaricom's rejection reason when an STK push is not accepted", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return requestCount === 1
      ? Response.json({ access_token: "access-token" })
      : Response.json({ errorMessage: "Invalid Access Token" }, { status: 401 });
  };

  try {
    await assert.rejects(
      startStkPush(
        {
          phone: "0712345678",
          amountKes: 400,
          accountReference: "ELM123456",
          transactionDesc: "Mathematics class",
        },
        productionEnv,
      ),
      /HTTP 401\): Invalid Access Token/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("includes the provider response description for rejected STK requests", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return requestCount === 1
      ? Response.json({ access_token: "access-token" })
      : Response.json({
          ResponseCode: "1",
          ResponseDescription: "Invalid Business Shortcode",
        });
  };

  try {
    await assert.rejects(
      startStkPush(
        {
          phone: "0712345678",
          amountKes: 400,
          accountReference: "ELM123456",
          transactionDesc: "Mathematics class",
        },
        productionEnv,
      ),
      /Invalid Business Shortcode/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
