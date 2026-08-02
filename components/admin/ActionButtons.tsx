"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Endpoint = "organizers" | "events" | "actions";

/** Admin action button with optional note prompt and confirmation. */
export function ActionButton({
  endpoint,
  payload,
  label,
  tone = "neutral",
  confirm,
  withNote,
}: {
  endpoint: Endpoint;
  payload: Record<string, unknown>;
  label: string;
  tone?: "primary" | "danger" | "neutral";
  confirm?: string;
  withNote?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;

    let note: string | null = null;
    if (withNote) {
      note = window.prompt("Add a note (the organizer may see this):") ?? "";
    }

    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(note ? { note } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      setResult(
        data.detail ??
          (data.paid === false
            ? "Chapa reports no successful payment."
            : "Done.")
      );
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    tone === "primary"
      ? "bg-crimson hover:bg-crimson-hover text-ink-100"
      : tone === "danger"
        ? "border border-crimson/50 text-crimson-hover hover:bg-crimson-muted/40"
        : "border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500";

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${cls}`}
      >
        {busy ? "…" : label}
      </button>
      {result && <span className="mt-1 text-[10px] text-ink-500">{result}</span>}
    </span>
  );
}
