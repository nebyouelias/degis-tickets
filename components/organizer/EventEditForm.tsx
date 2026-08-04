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

export type EditableTier = {
  id?: string;
  name: string;
  kind: string;
  priceEtb: string;
  capacity: string;
  sold: number; // 0 for newly added rows
};

export type EditableEvent = {
  id: string;
  title: string;
  titleAm: string;
  description: string;
  category: string;
  startsAtLocal: string; // yyyy-MM-ddTHH:mm
  coverImage: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  published: boolean;
  reviewStatus: string;
  tiers: EditableTier[];
};

export function EventEditForm({ event }: { event: EditableEvent }) {
  const router = useRouter();
  const [form, setForm] = useState(event);
  const [tiers, setTiers] = useState<EditableTier[]>(event.tiers);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof EditableEvent>(key: K, value: EditableEvent[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setTier(index: number, patch: Partial<EditableTier>) {
    setTiers((list) => list.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/organizer/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: form.startsAtLocal
            ? new Date(form.startsAtLocal).toISOString()
            : "",
          tiers: tiers
            .filter((t) => t.name.trim())
            .map((t) => ({
              id: t.id,
              name: t.name,
              kind: t.kind,
              priceEtb: Number(t.priceEtb || 0),
              capacity: Number(t.capacity || 0),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");

      if (data.flaggedForReview) {
        setNotice(
          "Saved. Because you changed the title, date or venue, Degis will re-check this event — it stays on sale in the meantime."
        );
      } else {
        router.push(`/organizer/events/${event.id}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        "Delete this event permanently? This can't be undone."
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/events/${event.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      router.push("/organizer");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const input =
    "mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson";
  const label = "text-xs font-medium uppercase tracking-luxe text-ink-500";
  const totalSold = tiers.reduce((s, t) => s + t.sold, 0);

  return (
    <div className="space-y-6">
      {totalSold > 0 && (
        <p className="rounded-card border border-gold/30 bg-gold-faint/40 p-4 text-sm text-ink-300">
          <span className="font-semibold text-gold">
            {totalSold} ticket{totalSold === 1 ? "" : "s"} already sold.
          </span>{" "}
          Price changes only affect new orders. Quantities can&apos;t be reduced
          below what&apos;s sold, and tiers with sales can&apos;t be removed.
        </p>
      )}

      {/* Details */}
      <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Event details</h2>

        <div className="mt-4">
          <label htmlFor="title" className={label}>
            Title (English)
          </label>
          <input
            id="title"
            className={input}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="titleAm" className={label}>
            Title (Amharic)
          </label>
          <input
            id="titleAm"
            className={`${input} font-ethiopic`}
            value={form.titleAm}
            onChange={(e) => set("titleAm", e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={label}>
              Category
            </label>
            <select
              id="category"
              className={input}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="startsAt" className={label}>
              Date &amp; time
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className={input}
              value={form.startsAtLocal}
              onChange={(e) => set("startsAtLocal", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className={label}>
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            className={input}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label className={label}>Event poster</label>
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
            <label htmlFor="venueName" className={label}>
              Venue name
            </label>
            <input
              id="venueName"
              className={input}
              value={form.venueName}
              onChange={(e) => set("venueName", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="venueCity" className={label}>
              City
            </label>
            <input
              id="venueCity"
              className={input}
              value={form.venueCity}
              onChange={(e) => set("venueCity", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="venueAddress" className={label}>
            Address / area
          </label>
          <input
            id="venueAddress"
            className={input}
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
            onClick={() =>
              setTiers((l) => [
                ...l,
                { name: "", kind: "GA", priceEtb: "", capacity: "", sold: 0 },
              ])
            }
            className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-300 transition-colors hover:border-gold/40 hover:text-ink-100"
          >
            + Add type
          </button>
        </div>

        <ul className="mt-4 space-y-4">
          {tiers.map((tier, i) => {
            const gold = ["VIP", "VVIP", "TABLE"].includes(tier.kind);
            const locked = tier.sold > 0;
            return (
              <li
                key={tier.id ?? `new-${i}`}
                className={`rounded-xl border p-4 ${
                  gold ? "border-gold/25 bg-gold-faint/30" : "border-ink-700 bg-ink-800"
                }`}
              >
                {locked && (
                  <p className="mb-3 text-xs font-medium uppercase tracking-luxe text-gold">
                    {tier.sold} sold
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor={`n-${i}`}>
                      Name
                    </label>
                    <input
                      id={`n-${i}`}
                      className={input}
                      value={tier.name}
                      onChange={(e) => setTier(i, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor={`k-${i}`}>
                      Type
                    </label>
                    <select
                      id={`k-${i}`}
                      className={input}
                      value={tier.kind}
                      onChange={(e) => setTier(i, { kind: e.target.value })}
                    >
                      {TIER_KINDS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor={`p-${i}`}>
                      Price (ETB)
                    </label>
                    <input
                      id={`p-${i}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className={input}
                      value={tier.priceEtb}
                      onChange={(e) => setTier(i, { priceEtb: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor={`c-${i}`}>
                      Quantity {locked && `(min ${tier.sold})`}
                    </label>
                    <input
                      id={`c-${i}`}
                      type="number"
                      min={tier.sold || 1}
                      inputMode="numeric"
                      className={input}
                      value={tier.capacity}
                      onChange={(e) => setTier(i, { capacity: e.target.value })}
                    />
                  </div>
                </div>

                {tiers.length > 1 && (
                  <button
                    type="button"
                    disabled={locked}
                    title={
                      locked
                        ? "Tickets have been sold — set the quantity to the sold count to close this tier instead"
                        : undefined
                    }
                    onClick={() =>
                      setTiers((l) => l.filter((_, idx) => idx !== i))
                    }
                    className="mt-3 text-sm text-ink-300 transition-colors hover:text-crimson-hover disabled:cursor-not-allowed disabled:opacity-40"
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
            <span className="font-semibold">On sale</span>
            <span className="mt-0.5 block text-sm text-ink-300">
              Uncheck to take this event off sale. Tickets already issued stay
              valid.
            </span>
          </span>
        </label>
      </section>

      {notice && (
        <p className="rounded-xl border border-gold/40 bg-gold-faint/40 p-3 text-center text-sm text-ink-100">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-full bg-crimson py-3.5 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {totalSold === 0 && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-full border border-crimson/50 px-6 py-3.5 text-sm font-semibold text-crimson-hover transition-colors hover:bg-crimson-muted/40 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
