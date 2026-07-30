import { createHash, randomBytes, randomInt } from "crypto";
import { db } from "@/lib/db";
import {
  ROTATION_STEP_SECONDS,
  eventSecret,
  maskForGate,
  ticketPublicKeyRaw,
} from "@/lib/ticket-crypto";

/**
 * Scanner device lifecycle.
 *
 * Pairing model: the organizer generates a short code per gate. A device
 * redeems it once and receives a bearer token plus everything it needs to work
 * offline — the event secret, the raw Ed25519 public key, the ticket manifest,
 * and a server timestamp for clock correction.
 *
 * Tokens are stored hashed, scoped to one event and one gate, and revocable
 * individually — which matters at 50 devices.
 */

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_TTL_MINUTES = 30;

export function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PAIRING_ALPHABET[randomInt(0, PAIRING_ALPHABET.length)];
  }
  return code;
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type ManifestTicket = {
  id: string;
  code: string;
  tier: string;
  kind: string;
  holder: string;
  status: string;
  checkedInAt: string | null;
};

/** Everything a device needs to validate every ticket for its event, offline. */
export async function buildManifest(eventId: string): Promise<ManifestTicket[]> {
  const tickets = await db.ticket.findMany({
    where: { eventId },
    include: { tier: true, order: { select: { deliveryPhone: true } } },
    orderBy: { createdAt: "asc" },
  });

  return tickets.map((t) => ({
    id: t.id,
    code: t.code,
    tier: t.tier.name,
    kind: t.tier.kind,
    holder: maskForGate(t.order.deliveryPhone),
    status: t.status,
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
  }));
}

export async function buildPairingPayload(eventId: string, gate: string) {
  const [event, manifest] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      include: { venue: true },
    }),
    buildManifest(eventId),
  ]);
  if (!event) throw new Error("Event not found");

  return {
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      venue: event.venue.name,
    },
    gate,
    eventSecret: eventSecret(eventId).toString("base64url"),
    publicKey: ticketPublicKeyRaw(),
    stepSeconds: ROTATION_STEP_SECONDS,
    serverTime: Date.now(),
    manifest,
  };
}

/** Resolve the Bearer token on a scanner request to an active device. */
export async function authenticateDevice(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const device = await db.scannerDevice.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { event: true },
  });
  if (!device || !device.active) return null;
  return device;
}
