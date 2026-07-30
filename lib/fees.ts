/**
 * Degis fees.
 * Online: 5% of subtotal, minimum 10 ETB, charged to the buyer.
 * Box office: small flat fee per ticket — it replaces the organizer's printing
 * cost and keeps cash sales worth digitizing (PRD §8).
 */

export function serviceFee(subtotalEtb: number): number {
  if (subtotalEtb <= 0) return 0;
  return Math.max(10, Math.ceil(subtotalEtb * 0.05));
}

export const BOX_OFFICE_FEE_PER_TICKET = 5;

export function boxOfficeFee(quantity: number): number {
  return Math.max(0, quantity) * BOX_OFFICE_FEE_PER_TICKET;
}
