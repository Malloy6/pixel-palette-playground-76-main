export type MpesaPaymentResult = {
  status: string;
  failureReason?: string;
};

export async function waitForMpesaPayment(reference: string): Promise<MpesaPaymentResult> {
  let delayMs = 1_500;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/mpesa/transactions/${encodeURIComponent(reference)}`, {
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message ?? "Could not check the M-Pesa payment status.");
    }
    if (payload.status !== "pending") {
      return {
        status: payload.status as string,
        failureReason: typeof payload.failureReason === "string" ? payload.failureReason : undefined,
      };
    }
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.5), 5_000);
  }
  return { status: "pending" };
}
