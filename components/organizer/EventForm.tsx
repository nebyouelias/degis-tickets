"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/organizer/ImageUpload";

const CATEGORIES = [
  ["CONCERT", "Concert"],
  ["NIGHTLIFE", "Nightlife"],
  ["FOOTBALL", "Football"],
  ["FESTIVAL", "Festival"],
  ["COMEDY", "Comedy"],
  ["CONFERENCE", "Conference"],
  ["CULTURAL", "Cultural"],
  ["CHURCH", "Church"],
  ["OTHER", "Other"],
] as const;

const TIER_KINDS = [
  ["GA", "General admission"],
  ["EARLY_BIRD", "Early bird"],
  ["STUDENT", "Student"],
  ["VIP", "VIP"],
  ["VVIP", "VVIP"],
  ["TABLE", "Table / lounge"],
] as const;

type Tier = {
  name: string;
  kind: string;
  priceEtb: string;
  capacity: string;
};

const emptyTier: Tier = { name: "", kind: "GA", priceEtb: "", capacity: "" };

export function EventForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    titleAm: "",
    description: "",
    category: "CONCERT",
    startsAt: "",
    coverImage: "",
    venueName: "",
    venueAddress: "",
    venueCity: "Addis Ababa",
    published: true,
  });
  const [tiers, setTiers] = useState<Tier[]>([
    { name: "General Admission", kind: "GA", priceEtb: "", capacity: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setTier(index: number, patch: Partial<Tier>) {
    setTiers((list) =>
      list.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
          tiers: tiers
            .filter((t) => t.name.trim())
            .map((t) => ({
              name: t.name,
              kind: t.kind,
              priceEtb: Number(t.priceEtb || 0),
              capacity: Number(t.capacity || 0),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the event.");
      router.push(`/organizer/events/${data.eventId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const inputCls =
    "mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson";
  const labelCls =
    "text-xs font-medium uppercase tracking-luxe text-ink-500";

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Event details</h2>

        <div className="mt-4">
          <label htmlFor="title" className={labelCls}>
            Title (English)
          </label>
          <input
            id="title"
            className={inputCls}
            placeholder="New Year Concert at Meskel Square"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="titleAm" className={labelCls}>
            Title (Amharic) — optional
          </label>
          <input
            id="titleAm"
            className={`${inputCls} font-ethiopic`}
            placeholder="የአዲስ ዓመት ኮንሰርት"
            value={form.titleAm}
            onChange={(e) => set("titleAm", e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelCls}>
              Category
            </label>
            <select
              id="category"
              className={inputCls}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="startsAt" className={labelCls}>
              Date &amp; time
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className={inputCls}
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className={labelCls}>
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            className={inputCls}
            placeholder="Doors at 7:30. Dress code enforced. Food and drinks available."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Event poster</label>
          <div className="mt-2">
            <ImageUpload
              value={form.coverImage}
              onChange={(url) => set("coverImage", url)}
            />
          </div>
        </div>
      </section>

      {/* Venue */}
      <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Venue</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="venueName" className={labelCls}>
              Venue name
            </label>
            <input
              id="venueName"
              className={inputCls}
              placeholder="Millennium Hall"
              value={form.venueName}
              onChange={(e) => set("venueName", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="venueCity" className={labelCls}>
              City
            </label>
            <input
              id="venueCity"
              className={inputCls}
              value={form.venueCity}
              onChange={(e) => set("venueCity", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="venueAddress" className={labelCls}>
            Address / area — optional
          </label>
          <input
            id="venueAddress"
            className={inputCls}
            placeholder="Bole Road"
            value={form.venueAddress}
            onChange={(e) => set("venueAddress", e.target.value)}
          />
        </div>
      </section>

      {/* Tiers */}
      <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Ticket types</h2>
          <button
            type="button"
            onClick={() => setTiers((l) => [...l, { ...emptyTier }])}
            className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-300 transition-colors hover:border-gold/40 hover:text-ink-100"
          >
            + Add type
          </button>
        </div>

        <ul className="mt-4 space-y-4">
          {tiers.map((tier, i) => {
            const gold = ["VIP", "VVIP", "TABLE"].includes(tier.kind);
            return (
              <li
                key={i}
                className={`rounded-xl border p-4 ${
                  gold ? "border-gold/25 bg-gold-faint/30" : "border-ink-700 bg-ink-800"
                }`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor={`tier-name-${i}`}>
                      Name
                    </label>
                    <input
                      id={`tier-name-${i}`}
                      className={inputCls}
                      placeholder="VIP Table (4 seats)"
                      value={tier.name}
                      onChange={(e) => setTier(i, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`tier-kind-${i}`}>
                      Type
                    </label>
                    <select
                      id={`tier-kind-${i}`}
                      className={inputCls}
                      value={tier.kind}
                      onChange={(e) => setTier(i, { kind: e.target.value })}
                    >
                      {TIER_KINDS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`tier-price-${i}`}>
                      Price (ETB)
                    </label>
                    <input
                      id={`tier-price-${i}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className={inputCls}
                      placeholder="800"
                      value={tier.priceEtb}
                      onChange={(e) => setTier(i, { priceEtb: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`tier-cap-${i}`}>
                      Quantity available
                    </label>
                    <input
                      id={`tier-cap-${i}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className={inputCls}
                      placeholder="500"
                      value={tier.capacity}
                      onChange={(e) => setTier(i, { capacity: e.target.value })}
                    />
                  </div>
                </div>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setTiers((l) => l.filter((_, idx) => idx !== i))
                    }
                    className="mt-3 text-sm text-ink-300 transition-colors hover:text-crimson-hover"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Publish */}
      <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set("published", e.target.checked)}
            className="mt-1 h-4 w-4 accent-crimson"
          />
          <span>
            <span className="font-semibold">Publish immediately</span>
            <span className="mt-0.5 block text-sm text-ink-300">
              Uncheck to save as a draft — it stays hidden until you publish.
            </span>
          </span>
        </label>
      </section>

      {error && (
        <p className="rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full rounded-full bg-crimson py-3.5 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create event"}
      </button>
    </div>
  );
}
