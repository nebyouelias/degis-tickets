import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, logAction } from "@/lib/admin";
import { sendSms } from "@/lib/sms";
import { issueTicketsForOrder } from "@/lib/issue-tickets";
import { chapaVerify } from "@/lib/chapa";
import { markOrderPaid } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/**
 * Support desk actions — the tools you actually need when a customer calls.
 *
 *  resend_ticket_sms  "I paid and got no message"
 *  reissue_tickets    paid order that somehow has no tickets
 *  recheck_payment    re-verify with Chapa and settle a stuck PENDING order
 *  void_ticket        stolen / disputed ticket
 *  restore_ticket     undo a void, or reverse a mistaken check-in
 *  refund_order       mark refunded and return inventory to sale
 */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  let body: { action?: string; id?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { action, id } = body;
  if (!action || !id) {
    return NextResponse.json({ error: "Missing action or id." }, { status: 400 });
  }

  const actorLabel = admin.phone ?? admin.email ?? "admin";
  const log = (targetType: string, note?: string) =>
    logAction({
      actorId: admin.id,
      actorLabel,
      action: action.toUpperCase(),
      targetType,
      targetId: id,
      note: note ?? body.note ?? null,
    });

  switch (action) {
    case "resend_ticket_sms": {
      const order = await db.order.findUnique({
        where: { id },
        include: { event: true, tickets: true },
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      if (!order.deliveryPhone) {
        return NextResponse.json(
          { error: "This order has no phone number." },
          { status: 400 }
        );
      }
      const site = (
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://degis-tickets.vercel.app"
      ).replace(/\/$/, "");
      const codes = order.tickets.map((t) => t.code).join(", ");
      const result = await sendSms(
        order.deliveryPhone,
        `Degis: your ${order.tickets.length} ticket(s) for ${order.event.title}. ` +
          `Code(s): ${codes}. Open ${site}/tickets`
      );
      await log("Order", "resent ticket SMS");
      return NextResponse.json({
        ok: result.delivered || result.devMode,
        provider: result.provider,
        error: result.error,
      });
    }

    case "reissue_tickets": {
      const count = await issueTicketsForOrder(id);
      await log("Order", `tickets now ${count}`);
      return NextResponse.json({ ok: true, ticketCount: count });
    }

    case "recheck_payment": {
      const order = await db.order.findUnique({ where: { id } });
      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      const verification = await chapaVerify(order.chapaTxRef);
      if (verification.paid && verification.amountEtb >= order.totalEtb) {
        await markOrderPaid(order.id);
        const count = await issueTicketsForOrder(order.id);
        await log("Order", "payment reconciled from Chapa");
        return NextResponse.json({ ok: true, paid: true, ticketCount: count });
      }
      await log("Order", "Chapa reports unpaid");
      return NextResponse.json({
        ok: true,
        paid: false,
        detail: "Chapa has no successful payment for this reference.",
      });
    }

    case "void_ticket": {
      await db.ticket.update({
        where: { id },
        data: { status: "VOID" },
      });
      await log("Ticket", "voided");
      return NextResponse.json({ ok: true });
    }

    case "restore_ticket": {
      await db.ticket.update({
        where: { id },
        data: { status: "VALID", checkedInAt: null },
      });
      await log("Ticket", "restored to valid");
      return NextResponse.json({ ok: true });
    }

    case "refund_order": {
      const order = await db.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      if (order.status === "REFUNDED") {
        return NextResponse.json({ ok: true, alreadyRefunded: true });
      }

      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        });
        await tx.ticket.updateMany({
          where: { orderId: order.id },
          data: { status: "VOID" },
        });
        // Return the seats to sale
        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "TicketTier"
            SET "sold" = GREATEST("sold" - ${item.quantity}, 0)
            WHERE "id" = ${item.tierId}
          `;
        }
      });

      await log("Order", "refunded, tickets voided, inventory released");

      if (order.deliveryPhone) {
        void sendSms(
          order.deliveryPhone,
          "Degis: your order has been refunded and the tickets cancelled. " +
            "The money is returned via your original payment method."
        );
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
