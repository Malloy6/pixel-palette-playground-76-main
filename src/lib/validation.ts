const emailLocalPartPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const emailDomainLabelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function isValidEmailAddress(value: string): boolean {
  if (value.length > 254) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !emailLocalPartPattern.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) => label.length <= 63 && emailDomainLabelPattern.test(label)) &&
    /^[A-Za-z]{2,63}$/.test(labels.at(-1) ?? "")
  );
}
