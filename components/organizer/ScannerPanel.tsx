"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Device = {
  id: string;
  gate: string;
  label: string | null;
  active: boolean;
  lastSeenAt: string | null;
  scanCount: number;
};

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function ScannerPanel({
  eventId,
  devices,
}: {
  eventId: string;
  devices: Device[];
}) {
  const router = useRouter();
  const [gate, setGate] = useState("Main gate");
  const [code, setCode] = useState<{ code: string; gate: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mintCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", eventId, gate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create a code.");
      setCode({ code: data.code, gate: data.gate });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(deviceId: string) {
    if (!window.confirm("Revoke this device? It will stop scanning immediately.")) {
      return;
    }
    await fetch("/api/organizer/scanner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", eventId, deviceId }),
    });
    router.refresh();
  }

  const byGate = devices.reduce<Record<string, Device[]>>((acc, d) => {
    (acc[d.gate] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          placeholder="Gate name"
          className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm outline-none transition-colors focus:border-crimson"
        />
        <button
          type="button"
          onClick={mintCode}
          disabled={busy || gate.trim().length < 2}
          className="shrink-0 rounded-full bg-crimson px-5 py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:opacity-50"
        >
          {busy ? "…" : "Get code"}
        </button>
      </div>

      {code && (
        <div className="mt-4 rounded-xl border border-gold/40 bg-gold-faint/50 p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-luxe text-gold">
            Pairing code · {code.gate}
          </p>
          <p className="mt-2 font-mono text-4xl font-black tracking-[0.25em] text-gold">
            {code.code}
          </p>
          <p className="mt-3 text-xs text-ink-300">
            On the door phone open <span className="font-semibold">/scan</span> and
            enter this code. Valid 30 minutes, single use.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}

      {devices.length > 0 && (
        <div className="mt-6 space-y-5">
          {Object.entries(byGate).map(([gateName, list]) => (
            <div key={gateName}>
              <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
                {gateName} · {list.filter((d) => d.active).length} active
              </p>
              <ul className="mt-2 space-y-2">
                {list.map((device) => (
                  <li
                    key={device.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${
                      device.active
                        ? "border-ink-700 bg-ink-800"
                        : "border-ink-700/50 bg-ink-900 opacity-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {device.label ?? "Unnamed device"}
                      </p>
                      <p className="text-xs text-ink-300">
                        {device.scanCount} scans · seen{" "}
                        {lastSeenLabel(device.lastSeenAt)}
                        {!device.active && " · revoked"}
                      </p>
                    </div>
                    {device.active && (
                      <button
                        type="button"
                        onClick={() => revoke(device.id)}
                        className="shrink-0 rounded-full border border-ink-700 px-3.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:border-crimson hover:text-ink-100"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {devices.length === 0 && (
        <p className="mt-4 text-sm text-ink-300">
          No devices paired yet. Generate a code per gate — each phone pairs once
          and then works offline for the whole event.
        </p>
      )}
    </div>
  );
}
