import {
  createPrivateKey,
  createPublicKey,
  createHmac,
  hkdfSync,
  timingSafeEqual,
  sign as cryptoSign,
  verify as cryptoVerify,
  randomBytes,
  type KeyObject,
} from "crypto";

/**
 * Ticket credentials — two layers.
 *
 * 1. Ed25519 signature (root of trust). Proves the ticket was issued by us.
 *    Scanners hold only the public key, so they verify offline and can never
 *    forge. This layer alone is what a paper/SMS ticket carries.
 *
 * 2. Rotating code (anti-screenshot). A TOTP-style code that changes every
 *    30 seconds. Key hierarchy:
 *
 *      TICKET_SIGNING_SEED  (server only — never leaves Vercel)
 *        └─ event secret     (given to that event's scanners at pairing)
 *             └─ ticket seed (given to the holder only, and only after activation)
 *
 *    A scanner can derive any ticket seed for ITS event and verify offline.
 *    It cannot touch another event. A holder learns only their own ticket's seed.
 *
 * Entry codes activate 2 hours before doors: before that, the holder's seed is
 * never served, so no valid entry code can exist anywhere. That kills the
 * advance "screenshot resale" market outright.
 */

const PAYLOAD_V1 = "DGS1"; // signature only (paper / box office tickets)
const PAYLOAD_V2 = "DGS2"; // signature + rotating code (app tickets)

export const ROTATION_STEP_SECONDS = 30;
export const ROTATION_TOLERANCE_STEPS = 2; // ±60s of clock drift
export const ENTRY_OPENS_HOURS_BEFORE = 2;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes
const CODE_LENGTH = 8;

// ---------- master key ----------

let cachedKeys: { privateKey: KeyObject; publicKey: KeyObject } | null = null;

function masterSeedText(): string {
  const seed = process.env.TICKET_SIGNING_SEED;
  if (!seed) throw new Error("TICKET_SIGNING_SEED is not set");
  return seed;
}

function keypair() {
  if (cachedKeys) return cachedKeys;

  const seed = hkdfSync(
    "sha256",
    Buffer.from(masterSeedText(), "utf8"),
    Buffer.from("degis-ticket-signing"),
    Buffer.from("ed25519-v1"),
    32
  );
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seed),
  ]);
  const privateKey = createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  cachedKeys = { privateKey, publicKey: createPublicKey(privateKey) };
  return cachedKeys;
}

/** Public key (base64url SPKI) — safe to hand to any scanner device. */
export function ticketPublicKey(): string {
  return keypair()
    .publicKey.export({ format: "der", type: "spki" })
    .toString("base64url");
}

// ---------- key hierarchy ----------

function hkdf(key: Buffer, info: string, salt: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", key, Buffer.from(salt), Buffer.from(info), 32)
  );
}

/** Per-event secret. Handed to that event's scanners — and nothing beyond. */
export function eventSecret(eventId: string): Buffer {
  return hkdf(
    Buffer.from(masterSeedText(), "utf8"),
    `event:${eventId}`,
    "degis-event-v1"
  );
}

/** Per-ticket seed. Served to the holder only, only after activation. */
export function ticketRotatingSeed(eventId: string, ticketId: string): Buffer {
  return hkdf(eventSecret(eventId), `ticket:${ticketId}`, "degis-ticket-v1");
}

// ---------- rotating code ----------

export function currentStep(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / ROTATION_STEP_SECONDS);
}

export function rotatingCode(seed: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const mac = createHmac("sha256", seed).update(counter).digest();
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[mac[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** Verify a rotating code, tolerating clock drift in either direction. */
export function verifyRotatingCode(
  eventId: string,
  ticketId: string,
  code: string,
  atMs: number = Date.now()
): { valid: boolean; driftSteps?: number } {
  if (code.length !== CODE_LENGTH) return { valid: false };

  const seed = ticketRotatingSeed(eventId, ticketId);
  const step = currentStep(atMs);
  const given = Buffer.from(code);

  for (let d = -ROTATION_TOLERANCE_STEPS; d <= ROTATION_TOLERANCE_STEPS; d++) {
    const expected = Buffer.from(rotatingCode(seed, step + d));
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      return { valid: true, driftSteps: d };
    }
  }
  return { valid: false };
}

// ---------- activation ----------

export function entryOpensAt(eventStartsAt: Date): Date {
  return new Date(
    eventStartsAt.getTime() - ENTRY_OPENS_HOURS_BEFORE * 60 * 60 * 1000
  );
}

export function entryIsOpen(eventStartsAt: Date, now: Date = new Date()): boolean {
  return now >= entryOpensAt(eventStartsAt);
}

// ---------- QR payloads ----------

/** Static signed body, shared by both payload versions. */
function signedBody(ticketId: string, eventId: string, version: string) {
  return `${version}.${ticketId}.${eventId}`;
}

function signatureFor(body: string): string {
  return cryptoSign(null, Buffer.from(body), keypair().privateKey).toString(
    "base64url"
  );
}

/**
 * Signature-only payload: DGS1.<ticketId>.<eventId>.<sig>
 * Used for box office paper tickets, which cannot rotate.
 */
export function buildStaticPayload(ticketId: string, eventId: string): string {
  const body = signedBody(ticketId, eventId, PAYLOAD_V1);
  return `${body}.${signatureFor(body)}`;
}

/** The signature half of a rotating payload — stable, safe to cache offline. */
export function entrySignature(ticketId: string, eventId: string): string {
  return signatureFor(signedBody(ticketId, eventId, PAYLOAD_V2));
}

/**
 * Rotating payload: DGS2.<ticketId>.<eventId>.<sig>.<rotatingCode>
 * Assembled on the holder's device every 30s, offline, from the cached
 * signature plus the cached seed.
 */
export function buildEntryPayload(
  ticketId: string,
  eventId: string,
  code: string
): string {
  const body = signedBody(ticketId, eventId, PAYLOAD_V2);
  return `${body}.${signatureFor(body)}.${code}`;
}

export type ParsedScan =
  | {
      valid: true;
      version: "DGS1" | "DGS2";
      ticketId: string;
      eventId: string;
      rotatingCode?: string;
    }
  | { valid: false; reason: "malformed" | "bad_signature" };

/**
 * Verify a scanned payload's signature and shape.
 * Rotating-code and single-use checks happen on top of this.
 */
export function parseAndVerifyScan(raw: string): ParsedScan {
  const parts = raw.trim().split(".");
  if (parts.length < 4 || parts.length > 5) {
    return { valid: false, reason: "malformed" };
  }

  const [version, ticketId, eventId, signature, code] = parts;
  if (
    (version !== PAYLOAD_V1 && version !== PAYLOAD_V2) ||
    !ticketId ||
    !eventId
  ) {
    return { valid: false, reason: "malformed" };
  }
  if (version === PAYLOAD_V2 && !code) {
    return { valid: false, reason: "malformed" };
  }

  try {
    const ok = cryptoVerify(
      null,
      Buffer.from(signedBody(ticketId, eventId, version)),
      keypair().publicKey,
      Buffer.from(signature, "base64url")
    );
    if (!ok) return { valid: false, reason: "bad_signature" };
  } catch {
    return { valid: false, reason: "bad_signature" };
  }

  return {
    valid: true,
    version,
    ticketId,
    eventId,
    ...(code ? { rotatingCode: code } : {}),
  };
}

// ---------- misc ----------

export function generateTicketCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `DGS-${code}`;
}

/** Mask a phone for display at the gate: 09••••567 */
export function maskForGate(phone: string | null | undefined): string {
  if (!phone) return "—";
  const local = phone.replace("+251", "0");
  return local.length >= 6
    ? `${local.slice(0, 2)}••••${local.slice(-3)}`
    : local;
}
