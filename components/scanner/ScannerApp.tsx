"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearAll,
  dequeueScans,
  enqueueScan,
  findByCode,
  getTicket,
  loadCursor,
  loadPairing,
  putTicket,
  queuedScans,
  savePairing,
  saveCursor,
  saveManifest,
  type LocalTicket,
  type Pairing,
} from "./store";
import { verifyScan, type ScanOutcome } from "./verify";

const SYNC_INTERVAL_MS = 10_000;
const RESULT_HOLD_MS = 2200;

type Display = ScanOutcome & { at: number };

const RESULT_STYLES: Record<
  ScanOutcome["result"],
  { bg: string; label: string; admit: boolean }
> = {
  ADMITTED: { bg: "bg-emerald-600", label: "ADMIT", admit: true },
  DUPLICATE: { bg: "bg-crimson", label: "ALREADY USED", admit: false },
  EXPIRED_CODE: { bg: "bg-crimson", label: "EXPIRED CODE", admit: false },
  WRONG_EVENT: { bg: "bg-crimson", label: "WRONG EVENT", admit: false },
  INVALID_SIGNATURE: { bg: "bg-crimson", label: "NOT VALID", admit: false },
  VOID_TICKET: { bg: "bg-crimson", label: "VOIDED", admit: false },
  UNKNOWN_TICKET: { bg: "bg-crimson", label: "UNKNOWN", admit: false },
};

export function ScannerApp() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [booting, setBooting] = useState(true);
  const [pairCode, setPairCode] = useState("");
  const [label, setLabel] = useState("");
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairing_busy, setPairingBusy] = useState(false);

  const [display, setDisplay] = useState<Display | null>(null);
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [counts, setCounts] = useState({ admitted: 0, total: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastRawRef = useRef<{ raw: string; at: number } | null>(null);

  // ---------- boot ----------
  useEffect(() => {
    void (async () => {
      try {
        const saved = await loadPairing();
        if (saved) setPairing(saved);
      } catch {
        /* first run */
      }
      setBooting(false);
    })();

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ---------- pairing ----------
  async function pair() {
    setPairingBusy(true);
    setPairError(null);
    try {
      const res = await fetch("/api/scan/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pairCode, label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pairing failed.");

      const next: Pairing = {
        deviceId: data.deviceId,
        deviceToken: data.deviceToken,
        gate: data.gate,
        event: data.event,
        eventSecret: data.eventSecret,
        publicKey: data.publicKey,
        stepSeconds: data.stepSeconds,
        serverTimeOffset: data.serverTime - Date.now(),
      };
      await savePairing(next);
      await saveManifest(data.manifest);
      await saveCursor(new Date().toISOString());
      setPairing(next);
      setCounts({
        admitted: data.manifest.filter(
          (t: LocalTicket) => t.status === "CHECKED_IN"
        ).length,
        total: data.manifest.length,
      });
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "Pairing failed.");
    } finally {
      setPairingBusy(false);
    }
  }

  // ---------- sync ----------
  const sync = useCallback(async () => {
    if (!pairing || !navigator.onLine) return;
    try {
      const [pending, cursor] = await Promise.all([queuedScans(), loadCursor()]);
      const res = await fetch("/api/scan/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pairing.deviceToken}`,
        },
        body: JSON.stringify({ scans: pending, since: cursor }),
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.accepted?.length) await dequeueScans(data.accepted);

      // Apply other gates' check-ins so this device stops accepting them
      for (const remote of data.checkedIn ?? []) {
        const local = await getTicket(remote.id);
        if (local && local.status !== remote.status) {
          await putTicket({
            ...local,
            status: remote.status,
            checkedInAt: remote.at,
          });
        }
      }

      if (data.counts) setCounts(data.counts);
      await saveCursor(new Date(data.serverTime - 60_000).toISOString());
      setQueueCount((await queuedScans()).length);
    } catch {
      /* offline again — the queue keeps waiting */
    }
  }, [pairing]);

  useEffect(() => {
    if (!pairing) return;
    void sync();
    const id = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pairing, sync]);

  // ---------- record a decision ----------
  const record = useCallback(
    async (outcome: ScanOutcome, ticketId: string | null) => {
      const scannedAt = new Date().toISOString();
      await enqueueScan({
        clientScanId: crypto.randomUUID(),
        ticketId,
        result: outcome.result,
        scannedAt,
      });

      // Mark locally right away so a second scan at THIS gate is a duplicate
      if (outcome.result === "ADMITTED" && ticketId) {
        const local = await getTicket(ticketId);
        if (local) {
          await putTicket({
            ...local,
            status: "CHECKED_IN",
            checkedInAt: scannedAt,
            scannedHere: true,
          });
        }
        setCounts((c) => ({ ...c, admitted: c.admitted + 1 }));
      }

      setQueueCount((await queuedScans()).length);
      if (navigator.onLine) void sync();
    },
    [sync]
  );

  const handleRaw = useCallback(
    async (raw: string) => {
      if (!pairing) return;

      // Debounce the same code re-read by the camera
      const last = lastRawRef.current;
      if (last && last.raw === raw && Date.now() - last.at < 3000) return;
      lastRawRef.current = { raw, at: Date.now() };

      const outcome = await verifyScan(raw, pairing, getTicket);
      setDisplay({ ...outcome, at: Date.now() });

      if (navigator.vibrate) {
        navigator.vibrate(outcome.result === "ADMITTED" ? 60 : [80, 60, 80]);
      }

      await record(outcome, outcome.ticket?.id ?? null);
      window.setTimeout(() => setDisplay(null), RESULT_HOLD_MS);
    },
    [pairing, record]
  );

  // ---------- camera ----------
  useEffect(() => {
    if (!pairing) return;
    let detector: { detect: (s: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null =
      null;
    let jsQR: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null =
      null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const BD = (
          window as unknown as {
            BarcodeDetector?: new (o: { formats: string[] }) => {
              detect: (s: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;

        if (BD) {
          detector = new BD({ formats: ["qr_code"] });
        } else {
          const mod = await import("jsqr");
          jsQR = (mod.default ?? mod) as typeof jsQR;
        }

        scanningRef.current = true;
        loop();
      } catch {
        setCameraError(
          "Camera unavailable. Use manual code entry, or allow camera access and reload."
        );
      }
    }

    function loop() {
      if (cancelled || !scanningRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const tick = async () => {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) await handleRaw(found[0].rawValue);
          } else if (jsQR && canvasRef.current) {
            const canvas = canvasRef.current;
            const w = (canvas.width = video.videoWidth || 640);
            const h = (canvas.height = video.videoHeight || 480);
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
              if (found?.data) await handleRaw(found.data);
            }
          }
        } catch {
          /* frame miss, keep going */
        }
        if (!cancelled) raf = requestAnimationFrame(loop);
      };
      void tick();
    }

    void start();
    return () => {
      cancelled = true;
      scanningRef.current = false;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [pairing, handleRaw]);

  // ---------- manual entry & override ----------
  async function lookupManual() {
    const found = await findByCode(manualCode);
    if (!found) {
      setDisplay({
        result: "UNKNOWN_TICKET",
        detail: `No ticket matching ${manualCode}`,
        at: Date.now(),
      });
    } else if (found.status === "CHECKED_IN") {
      setDisplay({
        result: "DUPLICATE",
        ticket: found,
        detail: "Already admitted",
        at: Date.now(),
      });
      await record({ result: "DUPLICATE", ticket: found }, found.id);
    } else if (found.status === "VOID") {
      setDisplay({ result: "VOID_TICKET", ticket: found, at: Date.now() });
      await record({ result: "VOID_TICKET", ticket: found }, found.id);
    } else {
      const outcome: ScanOutcome = {
        result: "ADMITTED",
        ticket: found,
        detail: "Admitted by code — check the phone number",
        degraded: true,
      };
      setDisplay({ ...outcome, at: Date.now() });
      await record(outcome, found.id);
    }
    setManualCode("");
    setShowManual(false);
    window.setTimeout(() => setDisplay(null), RESULT_HOLD_MS + 1500);
  }

  /** Dispute resolution: admit the holder who can show a live code. */
  async function overrideAdmit(ticket: LocalTicket) {
    await enqueueScan({
      clientScanId: crypto.randomUUID(),
      ticketId: ticket.id,
      result: "OVERRIDE_ADMITTED",
      scannedAt: new Date().toISOString(),
    });
    setQueueCount((await queuedScans()).length);
    setDisplay({
      result: "ADMITTED",
      ticket,
      detail: "Supervisor override recorded",
      at: Date.now(),
    });
    if (navigator.onLine) void sync();
    window.setTimeout(() => setDisplay(null), RESULT_HOLD_MS);
  }

  // ---------- render ----------

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <p className="font-ethiopic text-3xl text-gold">ድ</p>
      </div>
    );
  }

  if (!pairing) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <p className="text-center font-ethiopic text-3xl text-gold">ድ</p>
        <h1 className="mt-4 text-center text-2xl font-extrabold">Degis Scanner</h1>
        <p className="mt-2 text-center text-sm text-ink-300">
          Enter the pairing code from the organizer dashboard. This device will
          then work offline all night.
        </p>

        <input
          value={pairCode}
          onChange={(e) => setPairCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          className="mt-8 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-4 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-crimson"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Device name (e.g. Gate 2 – phone A)"
          className="mt-3 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm outline-none focus:border-crimson"
        />
        <button
          type="button"
          onClick={pair}
          disabled={pairing_busy || pairCode.length !== 6}
          className="mt-5 w-full rounded-full bg-crimson py-3.5 font-semibold disabled:opacity-50"
        >
          {pairing_busy ? "Pairing…" : "Pair this device"}
        </button>
        {pairError && (
          <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
            {pairError}
          </p>
        )}
      </div>
    );
  }

  const style = display ? RESULT_STYLES[display.result] : null;

  return (
    <div className="relative min-h-screen bg-ink-950">
      {/* Camera */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Status bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-ink-950/85 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{pairing.event.title}</p>
          <p className="text-xs text-ink-300">
            {pairing.gate} · {counts.admitted}/{counts.total} in
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              online
                ? "border-emerald-600/40 bg-emerald-950/40 text-emerald-400"
                : "border-gold/40 bg-gold-faint text-gold"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-gold"}`}
            />
            {online ? "Online" : "Offline"}
          </span>
          {queueCount > 0 && (
            <span className="rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 text-ink-300">
              {queueCount} queued
            </span>
          )}
        </div>
      </div>

      {/* Reticle */}
      {!display && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-64 w-64 rounded-3xl border-2 border-white/40" />
        </div>
      )}

      {/* Result overlay */}
      {display && style && (
        <div
          className={`absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center ${style.bg}`}
        >
          <p className="text-5xl font-black tracking-tight">{style.label}</p>
          {display.ticket && (
            <>
              <p className="mt-4 text-xl font-bold">{display.ticket.tier}</p>
              <p className="font-mono text-lg">{display.ticket.code}</p>
              <p className="mt-1 font-mono text-2xl font-bold">
                {display.ticket.holder}
              </p>
            </>
          )}
          {display.detail && (
            <p className="mt-4 max-w-xs text-sm opacity-90">{display.detail}</p>
          )}

          {/* Dispute path: only the real holder can show a refreshing code */}
          {display.result === "DUPLICATE" && display.ticket && (
            <button
              type="button"
              onClick={() => display.ticket && overrideAdmit(display.ticket)}
              className="mt-6 rounded-full border-2 border-white/70 px-6 py-3 text-sm font-bold"
            >
              Override — holder has a live code
            </button>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-ink-950/85 px-4 py-4 backdrop-blur">
        {cameraError && (
          <p className="mb-3 rounded-xl border border-gold/40 bg-gold-faint p-3 text-xs text-gold">
            {cameraError}
          </p>
        )}

        {showManual ? (
          <div className="flex gap-2">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="DGS-XXXXXX"
              className="flex-1 rounded-full border border-ink-700 bg-ink-800 px-4 py-3 font-mono outline-none focus:border-crimson"
            />
            <button
              type="button"
              onClick={lookupManual}
              disabled={manualCode.length < 4}
              className="rounded-full bg-crimson px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Check
            </button>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="rounded-full border border-ink-700 px-4 py-3 text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex-1 rounded-full border border-ink-700 py-3 text-sm font-medium text-ink-100"
            >
              Enter code manually
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  window.confirm(
                    "Unpair this device? Queued scans that haven't synced will be lost."
                  )
                ) {
                  await clearAll();
                  setPairing(null);
                }
              }}
              className="rounded-full border border-ink-700 px-4 py-3 text-sm text-ink-300"
            >
              Unpair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
