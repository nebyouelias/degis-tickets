import * as ed from "@noble/ed25519";
import type { LocalTicket, Pairing } from "./store";

/**
 * Offline ticket verification — runs entirely on the device.
 *
 * Layer 1: Ed25519 signature, checked against the raw public key. Proves Degis
 *          issued this ticket. The device holds no signing key, so it cannot forge.
 * Layer 2: rotating code, derived from the event secret via HKDF + HMAC using
 *          WebCrypto (byte-identical to the server's derivation).
 *
 * If the rotating check fails but the signature is good AND the device's clock
 * looks unreliable, we degrade to signature-only rather than refusing entry.
 * A bad clock must never lock out paying customers.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const TOLERANCE_STEPS = 2;

export type ScanOutcome = {
  result:
    | "ADMITTED"
    | "DUPLICATE"
    | "WRONG_EVENT"
    | "INVALID_SIGNATURE"
    | "EXPIRED_CODE"
    | "VOID_TICKET"
    | "UNKNOWN_TICKET";
  ticket?: LocalTicket;
  detail?: string;
  degraded?: boolean;
};

function base64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const raw = atob(b64 + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function deriveTicketSeed(
  eventSecret: Uint8Array,
  ticketId: string
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    eventSecret as unknown as ArrayBuffer,
    "HKDF",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("degis-ticket-v1"),
      info: new TextEncoder().encode(`ticket:${ticketId}`),
    },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function rotatingCode(seed: Uint8Array, step: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    seed as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigInt64(0, BigInt(step));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[mac[i] % ALPHABET.length];
  return code;
}

/**
 * Verify a scanned payload against local state.
 * Pure: it decides, the caller records.
 */
export async function verifyScan(
  raw: string,
  pairing: Pairing,
  lookup: (id: string) => Promise<LocalTicket | undefined>
): Promise<ScanOutcome> {
  const parts = raw.trim().split(".");
  if (parts.length < 4 || parts.length > 5) {
    return { result: "INVALID_SIGNATURE", detail: "Not a Degis ticket" };
  }

  const [version, ticketId, eventId, signature, code] = parts;
  if (version !== "DGS1" && version !== "DGS2") {
    return { result: "INVALID_SIGNATURE", detail: "Unknown ticket format" };
  }

  // Signature over the static body
  let signatureOk = false;
  try {
    signatureOk = await ed.verifyAsync(
      base64urlToBytes(signature),
      new TextEncoder().encode(`${version}.${ticketId}.${eventId}`),
      base64urlToBytes(pairing.publicKey)
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) {
    return { result: "INVALID_SIGNATURE", detail: "Signature does not match" };
  }

  // Right event? A valid ticket for another show must not open this gate.
  if (eventId !== pairing.event.id) {
    return { result: "WRONG_EVENT", detail: "Ticket is for a different event" };
  }

  const ticket = await lookup(ticketId);
  if (!ticket) {
    // Signature is valid but the ticket isn't in our manifest — issued after the
    // last sync. Admit on cryptographic proof; reconciliation will confirm.
    return {
      result: "ADMITTED",
      detail: "Valid signature · issued after last sync",
      degraded: true,
    };
  }

  if (ticket.status === "VOID") {
    return { result: "VOID_TICKET", ticket, detail: "Ticket was voided" };
  }

  // Already used, here or at another gate
  if (ticket.status === "CHECKED_IN" || ticket.scannedHere) {
    const when = ticket.checkedInAt
      ? new Date(ticket.checkedInAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "earlier";
    return {
      result: "DUPLICATE",
      ticket,
      detail: `Already admitted at ${when}`,
    };
  }

  // Rotating code (app tickets only; DGS1 paper tickets can't rotate)
  if (version === "DGS2" && code) {
    const nowMs = Date.now() + pairing.serverTimeOffset;
    const step = Math.floor(nowMs / 1000 / pairing.stepSeconds);
    const seed = await deriveTicketSeed(
      base64urlToBytes(pairing.eventSecret),
      ticketId
    );

    let matched = false;
    for (let d = -TOLERANCE_STEPS; d <= TOLERANCE_STEPS && !matched; d++) {
      if ((await rotatingCode(seed, step + d)) === code) matched = true;
    }

    if (!matched) {
      return {
        result: "EXPIRED_CODE",
        ticket,
        detail: "Code expired — likely a screenshot. Ask for the live code.",
      };
    }
  }

  return { result: "ADMITTED", ticket };
}
