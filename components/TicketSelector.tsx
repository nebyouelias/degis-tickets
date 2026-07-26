"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TierView = {
  id: string;
  name: string;
  kind: string;
  priceEtb: number;
  remaining: number;
};

const GOLD_KINDS = new Set(["VIP", "VVIP", "TABLE"]);

export function TicketSelector({
  eventId,
  tiers,
  signedIn,
  needsPhone,
}: {
  eventId: string;
  tiers: TierView[];
  signedIn: boolean;
  needsPhone: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = tiers.reduce(
    (s, t) => s + (qty[t.id] ?? 0) * t.priceEtb,
    0
  );
  const fee = subtotal > 0 ? Math.max(10, Math.ceil(subtotal * 0.05)) : 0;
  const total = subtotal + fee;
  const count = Object.values(qty).reduce((s, n) => s + n, 0);

  function bump(tierId: string, delta: number, max: number) {
    setQty((q) => {
      const next = Math.min(Math.max((q[tierId] ?? 0) + delta, 0), Math.min(max, 10));
      return { ...q, [tierId]: next };
    });
  }

  async function checkout() {
    if (!signedIn) {
      router.push("/signin");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([tierId, quantity]) => ({ tierId, quantity })),
          ...(phone ? { phone } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(false);
      router.refresh(); // re-pull availability in case something sold out
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-ET").format(n);

  return (
    <div>
      <ul className="mt-4 space-y-3">
        {tiers.map((tier) => {
          const gold = GOLD_KINDS.has(tier.kind);
          const out = tier.remaining <= 0;
          const n = qty[tier.id] ?? 0;
          return (
            <li
              key={tier.id}
              className={`rounded-xl border p-4 ${
                gold
                  ? "border-gold/25 bg-gold-faint/40"
                  : "border-ink-700 bg-ink-800"
              } ${out ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {tier.name}
                    {gold && (
                      <span className="rounded-full border border-gold/40 bg-gold-faint px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold">
                        {tier.kind}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-300">
                    {out
                      ? "Sold out"
                      : tier.remaining <= 20
                        ? `Only ${tier.remaining} left`
                        : "Available"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{fmt(tier.priceEtb)} ETB</p>
                  {!out && (
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => bump(tier.id, -1, tier.remaining)}
                        disabled={n === 0}
                        aria-label={`Remove one ${tier.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 text-ink-100 transition-colors hover:border-ink-500 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-semibold">{n}</span>
                      <button
                        type="button"
                        onClick={() => bump(tier.id, 1, tier.remaining)}
                        disabled={n >= Math.min(tier.remaining, 10)}
                        aria-label={`Add one ${tier.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 text-ink-100 transition-colors hover:border-ink-500 disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {count > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-ink-700 pt-4 text-sm">
          <div className="flex justify-between text-ink-300">
            <span>Subtotal</span>
            <span>{fmt(subtotal)} ETB</span>
          </div>
          <div className="flex justify-between text-ink-300">
            <span>Service fee</span>
            <span>{fmt(fee)} ETB</span>
          </div>
          <div className="flex justify-between text-base font-bold text-ink-100">
            <span>Total</span>
            <span>{fmt(total)} ETB</span>
          </div>
        </div>
      )}

      {signedIn && needsPhone && count > 0 && (
        <div className="mt-4">
          <label
            htmlFor="delivery-phone"
            className="text-xs font-medium uppercase tracking-luxe text-ink-500"
          >
            Phone for ticket delivery
          </label>
          <input
            id="delivery-phone"
            type="tel"
            inputMode="tel"
            placeholder="09XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson"
          />
        </div>
      )}

      <button
        type="button"
        onClick={checkout}
        disabled={busy || count === 0 || (signedIn && needsPhone && phone.trim().length < 9)}
        className="mt-5 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Starting payment…"
          : !signedIn
            ? "Sign in to buy"
            : count === 0
              ? "Select tickets"
              : `Pay ${fmt(total)} ETB`}
      </button>
      <p className="mt-2 text-center text-xs text-ink-500">
        Telebirr · CBE Birr · Cards — secure payment by Chapa
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
