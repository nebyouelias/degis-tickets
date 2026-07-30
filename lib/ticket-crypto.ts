import {
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  randomBytes,
  type KeyObject,
} from "crypto";

/**
 * Ticket signing (Ed25519).
 *
 * Why asymmetric: door scanners must verify tickets OFFLINE (venue connectivity
 * and national internet shutdowns are real risks — see PRD §5.4). Scanners hold
 * only the PUBLIC key, so a stolen scanner device cannot forge tickets.
 *
 * The keypair is derived deterministically from TICKET_SIGNING_SEED, so the
 * private key never has to be stored or transported — only the seed.
 */

const PAYLOAD_VERSION = "DGS1";

let cached: { privateKey: KeyObject; publicKey: KeyObject } | null = null;

function keypair() {
  if (cached) return cached;

  const seedText = process.env.TICKET_SIGNING_SEED;
  if (!seedText) throw new Error("TICKET_SIGNING_SEED is not set");

  // Stretch the human-provided seed into 32 bytes of key material
  const seed = hkdfSync(
    "sha256",
    Buffer.from(seedText, "utf8"),
    Buffer.from("degis-ticket-signing"),
    Buffer.from("ed25519-v1"),
    32
  );

  // Wrap the raw seed as a PKCS#8 Ed25519 private key
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seed),
  ]);

  const privateKey = createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  cached = { privateKey, publicKey: createPublicKey(privateKey) };
  return cached;
}

/** Public key (base64url SPKI) — safe to distribute to scanner devices. */
export function ticketPublicKey(): string {
  return keypair()
    .publicKey.export({ format: "der", type: "spki" })
    .toString("base64url");
}

/**
 * The exact string encoded into the QR code:
 *   DGS1.<ticketId>.<eventId>.<signature>
 * eventId is inside the signed payload so a scanner can reject a valid ticket
 * presented at the wrong event, entirely offline.
 */
export function buildQrPayload(ticketId: string, eventId: string): string {
  const body = `${PAYLOAD_VERSION}.${ticketId}.${eventId}`;
  const signature = cryptoSign(null, Buffer.from(body), keypair().privateKey);
  return `${body}.${signature.toString("base64url")}`;
}

/** Verify a scanned payload. Used by the API now, by scanners in Phase 6. */
export function verifyQrPayload(
  qr: string
): { valid: true; ticketId: string; eventId: string } | { valid: false } {
  const parts = qr.trim().split(".");
  if (parts.length !== 4) return { valid: false };

  const [version, ticketId, eventId, signature] = parts;
  if (version !== PAYLOAD_VERSION || !ticketId || !eventId) {
    return { valid: false };
  }

  try {
    const ok = cryptoVerify(
      null,
      Buffer.from(`${version}.${ticketId}.${eventId}`),
      keypair().publicKey,
      Buffer.from(signature, "base64url")
    );
    return ok ? { valid: true, ticketId, eventId } : { valid: false };
  } catch {
    return { valid: false };
  }
}

/** Short human-readable code for support and manual door lookup. */
export function generateTicketCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `DGS-${code}`;
}
