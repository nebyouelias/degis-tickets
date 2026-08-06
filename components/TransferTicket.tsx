"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Send a ticket to someone else's phone number. */
export function TransferTicket({
  ticketId,
  eventTitle,
}: {
  ticketId: string;
  eventTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ phone: string } | null>(null);

  async function send() {
    if (
      !window.confirm(
        `Send this ticket to ${phone}? Your copy stops working immediately and cannot be undone.`
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transfer failed.");
      setDone({ phone: data.toPhone });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-gold/40 bg-gold-faint/40 p-5 text-center">
        <p className="font-semibold text-gold">Ticket sent</p>
        <p className="mt-1 text-sm text-ink-300">
          {eventTitle} is now on {done.phone}. They&apos;ve been texted a link to
          sign in and see it.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 w-full rounded-full border border-ink-700 py-3 text-sm font-medium text-ink-300 transition-colors hover:border-gold/40 hover:text-ink-100"
      >
        Send this ticket to someone
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-ink-700 bg-ink-800 p-5">
      <p className="font-semibold">Send this ticket</p>
      <p className="mt-1 text-sm text-ink-300">
        Enter their phone number. Your copy stops working right away — this is the
        safe way to give someone a ticket.
      </p>

      <input
        type="tel"
        inputMode="tel"
        placeholder="09XX XXX XXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-4 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson"
      />

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={send}
          disabled={busy || phone.trim().length < 9}
          className="flex-1 rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send ticket"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-full border border-ink-700 px-5 py-3 text-sm text-ink-300"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
