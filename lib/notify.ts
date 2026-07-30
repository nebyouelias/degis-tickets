import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { ENTRY_OPENS_HOURS_BEFORE } from "@/lib/ticket-crypto";

/**
 * Transactional messaging.
 *
 * Templates are deliberately Latin-only: one Amharic character forces the whole
 * SMS into UCS-2 (70 chars/segment instead of 160), roughly 2.3x the cost at
 * volume. Amharic belongs in the app UI, not in the SMS bill.
 *
 * Every send is recorded on the order so retries, webhook replays, and cron
 * overlap can never text a buyer twice.
 */

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://degis-tickets.vercel.app"
  ).replace(/\/$/, "");
}

/** Sent as soon as payment is confirmed. */
export async function notifyOrderPaid(orderId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: { select: { id: true } } },
  });
  if (!order || order.status !== "PAID" || order.paidSmsAt) return false;
  if (!order.deliveryPhone) return false;

  // Claim the send first — a webhook replay racing this loses and stays silent
  const claimed = await db.order.updateMany({
    where: { id: order.id, paidSmsAt: null },
    data: { paidSmsAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const count = order.tickets.length;
  const body =
    `Degis: payment confirmed. ${count} ticket${count === 1 ? "" : "s"} for ` +
    `${order.event.title}. View: ${siteUrl()}/tickets ` +
    `Entry code appears ${ENTRY_OPENS_HOURS_BEFORE}h before doors.`;

  const result = await sendSms(order.deliveryPhone, body);
  if (!result.delivered && !result.devMode) {
    // Let a later attempt retry rather than silently swallowing the failure
    await db.order.update({
      where: { id: order.id },
      data: { paidSmsAt: null },
    });
    console.error("Paid SMS failed:", result.error);
    return false;
  }
  return true;
}

/** Sent when entry codes activate — the message the whole design depends on. */
export async function notifyEntryReady(orderId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: { include: { venue: true } } },
  });
  if (!order || order.status !== "PAID" || order.entrySmsAt) return false;
  if (!order.deliveryPhone) return false;

  const claimed = await db.order.updateMany({
    where: { id: order.id, entrySmsAt: null },
    data: { entrySmsAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const body =
    `Degis: your entry code for ${order.event.title} is now live. ` +
    `Open ${siteUrl()}/tickets NOW while you have signal - it then works ` +
    `offline at the gate. Screenshots will not scan.`;

  const result = await sendSms(order.deliveryPhone, body);
  if (!result.delivered && !result.devMode) {
    await db.order.update({
      where: { id: order.id },
      data: { entrySmsAt: null },
    });
    console.error("Entry SMS failed:", result.error);
    return false;
  }
  return true;
}

/** Box office: the walk-up customer gets their ticket code by text. */
export async function notifyBoxOfficeSale(orderId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      tickets: { include: { tier: true }, orderBy: { seq: "asc" } },
    },
  });
  if (!order || !order.deliveryPhone || order.paidSmsAt) return false;

  const claimed = await db.order.updateMany({
    where: { id: order.id, paidSmsAt: null },
    data: { paidSmsAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const codes = order.tickets.map((t) => t.code).join(", ");
  const body =
    `Degis: ${order.tickets.length} ticket${order.tickets.length === 1 ? "" : "s"} ` +
    `for ${order.event.title}. Code${order.tickets.length === 1 ? "" : "s"}: ${codes}. ` +
    `Keep this message - show it at the gate. ${siteUrl()}/tickets`;

  const result = await sendSms(order.deliveryPhone, body);
  if (!result.delivered && !result.devMode) {
    await db.order.update({
      where: { id: order.id },
      data: { paidSmsAt: null },
    });
    return false;
  }
  return true;
}
