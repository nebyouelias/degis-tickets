"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

const STORAGE_PREFIX = "degis.entry.";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

type EntryData = {
  ticketId: string;
  eventId: string;
  seed: string; // base64url
  signature: string;
  stepSeconds: number;
  serverTime: number;
  clientTimeAtFetch: number;
};

function base64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const raw = atob(b64 + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Same TOTP-style derivation as the server, via WebCrypto HMAC-SHA256. */
async function computeCode(seed: Uint8Array, step: number): Promise<string> {
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
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[mac[i] % ALPHABET.length];
  }
  return code;
}

export function TicketEntryCode({
  ticketId,
  gold,
}: {
  ticketId: string;
  gold: boolean;
}) {
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const lastStep = useRef<number | null>(null);

  const storageKey = `${STORAGE_PREFIX}${ticketId}`;

  // 1. Load cached credentials first (so a dead signal still works), then refresh
  useEffect(() => {
    let cached: EntryData | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) cached = JSON.parse(raw) as EntryData;
    } catch {
      /* ignore corrupt cache */
    }
    if (cached?.seed) {
      setEntry(cached);
      setOffline(true);
    }

    fetch(`/api/tickets/${ticketId}/entry`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Entry code unavailable.");
        const fresh: EntryData = { ...data, clientTimeAtFetch: Date.now() };
        setEntry(fresh);
        setOffline(false);
        setError(null);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(fresh));
        } catch {
          /* storage full or blocked — in-memory still works this session */
        }
      })
      .catch((e) => {
        if (!cached) setError(e instanceof Error ? e.message : "Unavailable.");
      });
  }, [ticketId, storageKey]);

  // 2. Tick every second; regenerate the QR only when the step changes
  const refresh = useCallback(async () => {
    if (!entry) return;

    // Trust the server's clock, not the phone's
    const offset = entry.serverTime - entry.clientTimeAtFetch;
    const nowMs = Date.now() + offset;
    const step = Math.floor(nowMs / 1000 / entry.stepSeconds);

    const elapsed = Math.floor(nowMs / 1000) % entry.stepSeconds;
    setSecondsLeft(entry.stepSeconds - elapsed);

    if (lastStep.current === step) return;
    lastStep.current = step;

    const next = await computeCode(base64urlToBytes(entry.seed), step);
    setCode(next);

    const payload = `DGS2.${entry.ticketId}.${entry.eventId}.${entry.signature}.${next}`;
    const svg = await QRCode.toString(payload, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0B0B0D", light: "#FFFFFF" },
    });
    setQrSvg(svg);
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(id);
  }, [entry, refresh]);

  if (error) {
    return (
      <div className="rounded-2xl border border-crimson/40 bg-crimson-muted/40 p-6 text-center">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm text-ink-300">
          Connect to the internet once to load your entry code.
        </p>
      </div>
    );
  }

  if (!entry || !qrSvg) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
        <p className="text-sm text-ink-300">Preparing your entry code…</p>
      </div>
    );
  }

  const pct = (secondsLeft / entry.stepSeconds) * 100;

  return (
    <div>
      <div className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-4">
        <div
          className="[&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      {/* Live refresh indicator — the visible proof this can't be a screenshot */}
      <div className="mx-auto mt-4 max-w-[280px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-luxe text-ink-500">
            Refreshes in {secondsLeft}s
          </span>
          <span
            className={`font-mono text-sm font-bold ${gold ? "text-gold" : "text-ink-100"}`}
          >
            {code}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-800">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              gold ? "bg-gold" : "bg-crimson"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        This code changes every {entry.stepSeconds} seconds. Screenshots will not
        scan at the gate.
        {offline && " Working offline from your saved code."}
      </p>
    </div>
  );
}
