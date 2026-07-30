"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Tier = {
  id: string;
  name: string;
  kind: string;
  priceEtb: number;
  remaining: number;
};

type IssuedTicket = { id: string; code: string; tierName: string };

const GOLD_KINDS = new Set(["VIP", "VVIP", "TABLE"]);
const fmt = (n: number) => new Intl.NumberFormat("en-ET").format(n);

/**
 * Box office: record a cash or transfer sale taken in person.
 * Issues real QR tickets immediately — the customer can be shown the code,
 * and if they later sign in with the same phone the ticket is already theirs.
 */
export function BoxOfficePanel({
  eventId,
  tiers,
}: {
  eventId: string;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [issued, setIssued] = useState<IssuedTicket[] | null>(null);
  const [collected, setCollected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = tiers.reduce((s, t) => s + (qty[t.id] ?? 0) * t.priceEtb, 0);
  const count = Object.values(qty).reduce((s, n) => s + n, 0);

  function bump(tierId: string, delta: number, max: number) {
    setQty((q) => ({
      ...q,
      [tierId]: Math.min(Math.max((q[tierId] ?? 0) + delta, 0), Math.min(max, 20)),
    }));
  }

  async function record() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/box-office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          customerPhone: phone || undefined,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([tierId, quantity]) => ({ tierId, quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sale failed.");
      setIssued(data.tickets);
      setCollected(data.collectedEtb);
      setQty({});
      setPhone("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sale failed.");
    } finally {
      setBusy(false);
    }
  }

  // Receipt view after a successful sale
  if (issued) {
    return (
      <div>
        <div className="rounded-xl border border-gold/30 bg-gold-faint/40 p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-luxe text-gold">
            Sale recorded
          </p>
          <p className="mt-1 text-2xl font-bold text-gold">
            {fmt(collected)} ETB collected
          </p>
          <p className="mt-1 text-sm text-ink-300">
            {issued.length} ticket{issued.length === 1 ? "" : "s"} issued
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {issued.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-800 p-3.5"
            >
              <div>
                <p className="font-mono font-bold">{t.code}</p>
                <p className="text-sm text-ink-300">{t.tierName}</p>
              </div>
              <Link
                href={`/tickets/${t.id}`}
                target="_blank"
                className="rounded-full border border-ink-700 px-3.5 py-1.5 text-sm text-ink-100 transition-colors hover:border-gold/40"
              >
                Show QR
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setIssued(null)}
          className="mt-5 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover"
        >
          New sale
        </button>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2.5">
        {tiers.map((tier) => {
          const gold = GOLD_KINDS.has(tier.kind);
          const out = tier.remaining <= 0;
          const n = qty[tier.id] ?? 0;
          return (
            <li
              key={tier.id}
              className={`flex items-center justify-between rounded-xl border p-3.5 ${
                gold ? "border-gold/25 bg-gold-faint/30" : "border-ink-700 bg-ink-800"
              } ${out ? "opacity-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{tier.name}</p>
                <p className="mt-0.5 text-sm text-ink-300">
                  {fmt(tier.priceEtb)} ETB ·{" "}
                  {out ? "sold out" : `${tier.remaining} left`}
                </p>
              </div>
              {!out && (
                <div className="ml-3 flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => bump(tier.id, -1, tier.remaining)}
                    disabled={n === 0}
                    aria-label={`Remove one ${tier.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 text-lg transition-colors hover:border-ink-500 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold">{n}</span>
                  <button
                    type="button"
                    onClick={() => bump(tier.id, 1, tier.remaining)}
                    disabled={n >= Math.min(tier.remaining, 20)}
                    aria-label={`Add one ${tier.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 text-lg transition-colors hover:border-ink-500 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <label
          htmlFor="bo-phone"
          className="text-xs font-medium uppercase tracking-luxe text-ink-500"
        >
          Customer phone — optional
        </label>
        <input
          id="bo-phone"
          type="tel"
          inputMode="tel"
          placeholder="09XX XXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson"
        />
        <p className="mt-2 text-xs text-ink-500">
          Add it and the ticket lands in their Degis wallet when they sign in with
          that number.
        </p>
      </div>

      {count > 0 && (
        <div className="mt-4 flex justify-between border-t border-ink-700 pt-4 font-bold">
          <span>Collect</span>
          <span>{fmt(subtotal)} ETB</span>
        </div>
      )}

      <button
        type="button"
        onClick={record}
        disabled={busy || count === 0}
        className="mt-4 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Recording…"
          : count === 0
            ? "Select tickets"
            : `Record sale · ${fmt(subtotal)} ETB`}
      </button>

      {error && (
        <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
