import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Inventory correctness lives here.
 * Reservations are atomic conditional UPDATEs — the database guarantees we
 * never sell past capacity, even under concurrent checkouts.
 */

export class SoldOutError extends Error {
  constructor(public tierName: string) {
    super(`Not enough availability for ${tierName}`);
  }
}

/** Atomically reserve quantities inside an existing transaction. */
export async function reserveTiers(
  tx: Prisma.TransactionClient,
  items: Array<{ tierId: string; quantity: number; tierName: string }>
) {
  for (const item of items) {
    const updated = await tx.$executeRaw`
      UPDATE "TicketTier"
      SET "sold" = "sold" + ${item.quantity}
      WHERE "id" = ${item.tierId}
        AND "sold" + ${item.quantity} <= "capacity"
    `;
    if (updated !== 1) throw new SoldOutError(item.tierName);
  }
}

/**
 * Release inventory held by expired pending orders.
 * Called opportunistically before availability-sensitive operations —
 * serverless-friendly (no cron needed at this stage).
 */
export async function releaseExpiredOrders(eventId?: string) {
  const expired = await db.order.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
      ...(eventId ? { eventId } : {}),
    },
    include: { items: true },
    take: 20,
  });

  for (const order of expired) {
    await db.$transaction(async (tx) => {
      const marked = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (marked.count !== 1) return; // someone else handled it (or it got paid)
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "TicketTier"
          SET "sold" = GREATEST("sold" - ${item.quantity}, 0)
          WHERE "id" = ${item.tierId}
        `;
      }
    });
  }
}

/** Mark an order paid exactly once. Returns true only for the winning caller. */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const updated = await db.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  return updated.count === 1;
}
