import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { generateTicketCode } from "@/lib/ticket-crypto";
import { sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const MAX_TRANSFERS_PER_TICKET = 3;

/**
 * Transfer a ticket to another phone number.
 *
 * Why this issues a NEW ticket rather than reassigning the existing one:
 * the rotating entry code is derived from the ticket id, and the sender's phone
 * has that seed cached. If the id stayed the same, the sender could keep
 * generating valid entry codes offline after giving the ticket away. So the
 * original is voided and a fresh ticket is created — new id, new code, new seed.
 *
 * This is also the anti-fraud feature: when sending a ticket is this easy,
 * nobody needs to share a screenshot.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const toPhone = normalizePhone(body.phone ?? "");
  if (!toPhone) {
    return NextResponse.json(
      { error: "Enter a valid phone number, e.g. 09XX XXX XXX." },
      { status: 400 }
    );
  }

  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: {
      event: { include: { venue: true } },
      tier: true,
      order: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  // Ownership: ownerId is authoritative, falling back to the buyer for
  // any ticket issued before ownership tracking existed.
  const ownerId = ticket.ownerId ?? ticket.order.userId;
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  if (ticket.status === "CHECKED_IN") {
    return NextResponse.json(
      { error: "This ticket has already been used at the gate." },
      { status: 400 }
    );
  }
  if (ticket.status === "VOID") {
    return NextResponse.json(
      { error: "This ticket is no longer valid." },
      { status: 400 }
    );
  }
  if (ticket.event.startsAt < new Date()) {
    return NextResponse.json(
      { error: "This event has already started — transfers are closed." },
      { status: 400 }
    );
  }
  if (toPhone === (user.phone ?? "")) {
    return NextResponse.json(
      { error: "That's your own number." },
      { status: 400 }
    );
  }

  // Cap re-transfers so this can't become an untracked resale chain
  const priorTransfers = await db.ticketTransfer.count({
    where: { toTicketId: ticket.id },
  });
  if (priorTransfers >= MAX_TRANSFERS_PER_TICKET) {
    return NextResponse.json(
      {
        error:
          "This ticket has been transferred too many times. Contact Degis support.",
      },
      { status: 400 }
    );
  }

  const recipient = await db.user.upsert({
    where: { phone: toPhone },
    update: {},
    create: { phone: toPhone },
  });

  if (recipient.id === user.id) {
    return NextResponse.json(
      { error: "That's your own account." },
      { status: 400 }
    );
  }

  // Void the old, issue the new — atomically, so a ticket can never be
  // duplicated or lost partway through.
  const newTicket = await db.$transaction(async (tx) => {
    const voided = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "VALID" },
      data: { status: "VOID" },
    });
    if (voided.count !== 1) {
      throw new Error("Ticket state changed — try again.");
    }

    const maxSeq = await tx.ticket.aggregate({
      where: { orderId: ticket.orderId },
      _max: { seq: true },
    });

    const created = await tx.ticket.create({
      data: {
        code: generateTicketCode(),
        seq: (maxSeq._max.seq ?? 0) + 1,
        orderId: ticket.orderId,
        tierId: ticket.tierId,
        eventId: ticket.eventId,
        ownerId: recipient.id,
        status: "VALID",
      },
    });

    await tx.ticketTransfer.create({
      data: {
        fromTicketId: ticket.id,
        toTicketId: created.id,
        fromUserId: user.id,
        toUserId: recipient.id,
        toPhone,
      },
    });

    return created;
  });

  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://degis-tickets.vercel.app"
  ).replace(/\/$/, "");

  void sendSms(
    toPhone,
    `Degis: you have been sent a ticket for ${ticket.event.title}. ` +
      `Code: ${newTicket.code}. Sign in at ${site}/tickets with this number to see it.`
  );

  return NextResponse.json({
    ok: true,
    newTicketCode: newTicket.code,
    toPhone,
  });
}
