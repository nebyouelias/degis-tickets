"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetupForm({ defaultPhone }: { defaultPhone?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the profile.");
      router.push("/organizer");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const inputCls =
    "mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson";

  return (
    <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 shadow-card">
      <label
        htmlFor="org-name"
        className="text-xs font-medium uppercase tracking-luxe text-ink-500"
      >
        Organizer or venue name
      </label>
      <input
        id="org-name"
        className={inputCls}
        placeholder="Sheger Events"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label
        htmlFor="org-phone"
        className="mt-4 block text-xs font-medium uppercase tracking-luxe text-ink-500"
      >
        Contact phone
      </label>
      <input
        id="org-phone"
        type="tel"
        inputMode="tel"
        className={inputCls}
        placeholder="09XX XXX XXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <button
        type="button"
        onClick={submit}
        disabled={busy || name.trim().length < 2}
        className="mt-6 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create organizer profile"}
      </button>

      {error && (
        <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-ink-500">
        You can start selling right away. The verified badge is granted after a
        quick review by the Degis team.
      </p>
    </div>
  );
}
