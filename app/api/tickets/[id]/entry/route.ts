import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ROTATION_STEP_SECONDS,
  entryIsOpen,
  entryOpensAt,
  entrySignature,
  ticketRotatingSeed,
} from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

/**
 * Serve the rotating seed for a ticket — the moment that makes late activation
 * real. Before T-2h this returns 403 and no valid entry code can exist anywhere,
 * because the seed has never left the server.
 *
 * After activation the holder caches the seed and generates codes offline all
 * night. serverTime lets the client correct for a wrong phone clock.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: { event: true, order: true },
  });

  if (!ticket || ticket.order.userId !== user.id) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  if (ticket.status === "VOID") {
    return NextResponse.json({ error: "This ticket is void." }, { status: 403 });
  }

  const opensAt = entryOpensAt(ticket.event.startsAt);
  if (!entryIsOpen(ticket.event.startsAt)) {
    return NextResponse.json(
      {
        error: "Entry code not active yet.",
        opensAt: opensAt.toISOString(),
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ticketId: ticket.id,
    eventId: ticket.eventId,
    seed: ticketRotatingSeed(ticket.eventId, ticket.id).toString("base64url"),
    signature: entrySignature(ticket.id, ticket.eventId),
    stepSeconds: ROTATION_STEP_SECONDS,
    serverTime: Date.now(),
    status: ticket.status,
  });
}
