import { db } from "@/lib/db";
import { generateTicketCode } from "@/lib/ticket-crypto";

/**
 * Issue tickets for a PAID order.
 *
 * Idempotent by construction: rows are keyed on (orderId, seq) with a unique
 * constraint and inserted with skipDuplicates, so the webhook and the order
 * page can both call this — even simultaneously — and the buyer still gets
 * exactly the right number of tickets.
 */
export async function issueTicketsForOrder(orderId: string): Promise<number> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, tickets: { select: { id: true } } },
  });

  if (!order || order.status !== "PAID") return 0;

  const expected = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (order.tickets.length >= expected) return order.tickets.length;

  // Build one row per ticket, with a stable seq across the whole order
  const rows: Array<{
    code: string;
    seq: number;
    orderId: string;
    tierId: string;
    eventId: string;
  }> = [];

  let seq = 0;
  for (const item of order.items) {
    for (let i = 0; i < item.quantity; i++) {
      rows.push({
        code: generateTicketCode(),
        seq,
        orderId: order.id,
        tierId: item.tierId,
        eventId: order.eventId,
      });
      seq++;
    }
  }

  await db.ticket.createMany({ data: rows, skipDuplicates: true });

  return db.ticket.count({ where: { orderId: order.id } });
}
