/**
 * Degis service fee: 5% of subtotal, minimum 10 ETB, buyer-side.
 * Collected on top of the organizer's ticket price.
 */
export function serviceFee(subtotalEtb: number): number {
  if (subtotalEtb <= 0) return 0;
  return Math.max(10, Math.ceil(subtotalEtb * 0.05));
}
