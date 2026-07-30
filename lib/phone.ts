/**
 * Normalize phone input to E.164.
 * Accepts Ethiopian formats (09xxxxxxxx, 07xxxxxxxx, 9xxxxxxxx, +2519xxxxxxxx)
 * and full international numbers with a leading + (for diaspora/testing).
 * Returns null if the input can't be confidently normalized.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  // Full international
  if (cleaned.startsWith("+")) {
    return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
  }

  // Ethiopian local formats
  if (/^0[79]\d{8}$/.test(cleaned)) return `+251${cleaned.slice(1)}`;
  if (/^[79]\d{8}$/.test(cleaned)) return `+251${cleaned}`;
  if (/^251[79]\d{8}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}

export function maskPhone(phone: string): string {
  return phone.length > 6
    ? `${phone.slice(0, 4)}•••${phone.slice(-3)}`
    : phone;
}
