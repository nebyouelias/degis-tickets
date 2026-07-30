import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildPairingPayload,
  generateDeviceToken,
  hashToken,
} from "@/lib/scanner";

export const dynamic = "force-dynamic";

/**
 * A device redeems a pairing code, once, and receives its offline toolkit.
 * No organizer credentials ever reach the door phone.
 */
export async function POST(request: Request) {
  let body: { code?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-character pairing code." },
      { status: 400 }
    );
  }

  const pairing = await db.pairingCode.findUnique({ where: { code } });
  if (!pairing || pairing.usedAt || pairing.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "That code is invalid or expired. Ask for a new one." },
      { status: 400 }
    );
  }

  const token = generateDeviceToken();

  const device = await db.$transaction(async (tx) => {
    // Single-use: claim the code, and bail if another device just took it
    const claimed = await tx.pairingCode.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("Code already used");

    return tx.scannerDevice.create({
      data: {
        eventId: pairing.eventId,
        gate: pairing.gate,
        label: (body.label ?? "").trim().slice(0, 40) || null,
        tokenHash: hashToken(token),
        lastSeenAt: new Date(),
      },
    });
  });

  const payload = await buildPairingPayload(pairing.eventId, pairing.gate);

  return NextResponse.json({
    deviceId: device.id,
    deviceToken: token,
    ...payload,
  });
}
