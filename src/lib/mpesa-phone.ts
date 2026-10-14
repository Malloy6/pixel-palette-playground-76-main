export function normalizeMpesaPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 10 && digits.startsWith("0")
      ? `254${digits.slice(1)}`
      : digits.length === 12 && digits.startsWith("254")
        ? digits
        : "";

  // STK Push prompts can only be delivered to an active M-Pesa line.  Do not
  // accept every Kenyan mobile prefix here: in particular, 073x and 078x are
  // normally Airtel ranges and result in a request that can never be approved
  // on an M-Pesa handset. Keep this in sync with the sign-up validation.
  return /^254(?:10|11|70|71|72|74|75|76|79)\d{7}$/.test(normalized) ? normalized : null;
}

export function isSafaricomMpesaPhone(phone: string) {
  return /^254(?:10|11|70|71|72|74|75|76|79)\d{7}$/.test(phone);
}
