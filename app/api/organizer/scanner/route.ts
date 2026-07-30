import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMyOrganizer, getOwnedEvent } from "@/lib/organizer";
import { generatePairingCode } from "@/lib/scanner";

export const dynamic = "force-dynamic";

const PAIRING_TTL_MS = 30 * 60 * 1000;

/** Organizer actions: mint a pairing code for a gate, or revoke a device. */
export async function POST(request: Request) {
  const { user, organizer } = await getMyOrganizer();
  if (!user || !organizer) {
    return NextResponse.json({ error: "Organizer only." }, { status: 403 });
  }

  let body: {
    action?: "pair" | "revoke";
    eventId?: string;
    gate?: string;
    deviceId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "Missing event." }, { status: 400 });
  }

  // Ownership is always verified against the caller's own organizer record
  const event = await getOwnedEvent(body.eventId, organizer.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (body.action === "revoke") {
    if (!body.deviceId) {
      return NextResponse.json({ error: "Missing device." }, { status: 400 });
    }
    const result = await db.scannerDevice.updateMany({
      where: { id: body.deviceId, eventId: event.id },
      data: { active: false },
    });
    return NextResponse.json({ ok: result.count === 1 });
  }

  const gate = (body.gate ?? "").trim().slice(0, 40) || "Main gate";

  // One live code per gate at a time keeps the door staff instructions simple
  await db.pairingCode.updateMany({
    where: { eventId: event.id, gate, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const pairing = await db.pairingCode.create({
    data: {
      code: generatePairingCode(),
      eventId: event.id,
      gate,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
    },
  });

  return NextResponse.json({
    code: pairing.code,
    gate,
    expiresAt: pairing.expiresAt.toISOString(),
  });
}
