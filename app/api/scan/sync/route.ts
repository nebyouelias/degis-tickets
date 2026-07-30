import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateDevice } from "@/lib/scanner";
import type { ScanResult } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_RESULTS = new Set<ScanResult>([
  "ADMITTED",
  "DUPLICATE",
  "WRONG_EVENT",
  "INVALID_SIGNATURE",
  "EXPIRED_CODE",
  "VOID_TICKET",
  "UNKNOWN_TICKET",
  "OVERRIDE_ADMITTED",
]);

const MAX_SCANS_PER_SYNC = 500;

type IncomingScan = {
  clientScanId?: string;
  ticketId?: string | null;
  result?: string;
  scannedAt?: string;
};

/**
 * Two-way sync for offline scanners.
 *
 * Push: scans queued on the device. Idempotent on clientScanId, so a device can
 * retry the same batch after a dropped connection without double-recording.
 *
 * Pull: check-ins recorded by OTHER gates since the device's cursor. This is what
 * shrinks the cross-gate blind spot from hours to seconds whenever there's signal.
 */
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return NextResponse.json(
      { error: "Device not paired or revoked." },
      { status: 401 }
    );
  }

  let body: { scans?: IncomingScan[]; since?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const scans = (body.scans ?? []).slice(0, MAX_SCANS_PER_SYNC);
  const accepted: string[] = [];

  for (const scan of scans) {
    if (
      !scan.clientScanId ||
      !scan.result ||
      !VALID_RESULTS.has(scan.result as ScanResult) ||
      !scan.scannedAt
    ) {
      continue;
    }

    const scannedAt = new Date(scan.scannedAt);
    if (Number.isNaN(scannedAt.getTime())) continue;

    // Only accept tickets that belong to this device's event
    let ticketId: string | null = null;
    if (scan.ticketId) {
      const ticket = await db.ticket.findFirst({
        where: { id: scan.ticketId, eventId: device.eventId },
        select: { id: true },
      });
      ticketId = ticket?.id ?? null;
    }

    try {
      await db.scanRecord.create({
        data: {
          clientScanId: scan.clientScanId,
          ticketId,
          eventId: device.eventId,
          deviceId: device.id,
          gate: device.gate,
          result: scan.result as ScanResult,
          scannedAt,
        },
      });
    } catch {
      // Unique violation on clientScanId — already synced, which is fine
      accepted.push(scan.clientScanId);
      continue;
    }

    // An admitting scan marks the ticket used. First one wins; later ones no-op.
    if (
      ticketId &&
      (scan.result === "ADMITTED" || scan.result === "OVERRIDE_ADMITTED")
    ) {
      await db.ticket.updateMany({
        where: { id: ticketId, status: "VALID" },
        data: { status: "CHECKED_IN", checkedInAt: scannedAt },
      });
    }

    accepted.push(scan.clientScanId);
  }

  await db.scannerDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  // Deltas from other gates
  const since = body.since ? new Date(body.since) : null;
  const checkedIn = await db.ticket.findMany({
    where: {
      eventId: device.eventId,
      status: { in: ["CHECKED_IN", "VOID"] },
      ...(since && !Number.isNaN(since.getTime())
        ? { checkedInAt: { gte: since } }
        : {}),
    },
    select: { id: true, status: true, checkedInAt: true },
    take: 2000,
  });

  const [admitted, total] = await Promise.all([
    db.ticket.count({
      where: { eventId: device.eventId, status: "CHECKED_IN" },
    }),
    db.ticket.count({ where: { eventId: device.eventId } }),
  ]);

  return NextResponse.json({
    accepted,
    serverTime: Date.now(),
    counts: { admitted, total },
    checkedIn: checkedIn.map((t) => ({
      id: t.id,
      status: t.status,
      at: t.checkedInAt?.toISOString() ?? null,
    })),
  });
}
