import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { maskForGate } from "@/lib/ticket-crypto";
import { formatEventDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * PUBLIC ticket verification page.
 *
 * This is the anti-scam tool: anyone offered a ticket on Telegram can scan the
 * pass QR and immediately see whose ticket it is. Deliberately shows only
 * masked, non-sensitive facts — and states plainly that it grants no entry.
 */
export default async function VerifyTicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: {
      tier: true,
      event: { include: { venue: true, organizer: true } },
      order: { select: { deliveryPhone: true } },
    },
  });

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <div className="rounded-card border border-crimson/50 bg-crimson-muted/40 p-8">
          <p className="text-3xl">⚠️</p>
          <h1 className="mt-3 text-2xl font-extrabold">No such ticket</h1>
          <p className="mt-2 text-sm text-ink-100">
            This code does not match any ticket issued by Degis. If someone is
            selling it to you, it is not genuine.
          </p>
        </div>
      </div>
    );
  }

  const voided = ticket.status === "VOID";
  const used = ticket.status === "CHECKED_IN";

  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <div
        className={`rounded-card border p-6 shadow-card ${
          voided
            ? "border-crimson/50 bg-crimson-muted/30"
            : "border-gold/30 bg-ink-900"
        }`}
      >
        <div className="text-center">
          <p className="font-ethiopic text-2xl text-gold">ድግስ</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-luxe text-ink-500">
            Ticket verification
          </p>
        </div>

        <div className="mt-6 text-center">
          {voided ? (
            <>
              <p className="text-2xl font-extrabold text-ink-100">
                Ticket voided
              </p>
              <p className="mt-1 text-sm text-ink-300">
                This ticket is no longer valid for entry.
              </p>
            </>
          ) : used ? (
            <>
              <p className="text-2xl font-extrabold text-ink-100">
                Already used
              </p>
              <p className="mt-1 text-sm text-ink-300">
                This ticket has been scanned at the gate.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-gold">Genuine ticket</p>
              <p className="mt-1 text-sm text-ink-300">
                Issued by Degis Tickets
              </p>
            </>
          )}
        </div>

        <dl className="mt-7 space-y-4 border-t border-ink-700 pt-5 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Event
            </dt>
            <dd className="mt-1 font-semibold">{ticket.event.title}</dd>
            <dd className="text-ink-300">
              {formatEventDateTime(ticket.event.startsAt)} ·{" "}
              {ticket.event.venue.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Ticket
            </dt>
            <dd className="mt-1 font-semibold">
              {ticket.tier.name} · <span className="font-mono">{ticket.code}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Held by
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold">
              {maskForGate(ticket.order.deliveryPhone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Organizer
            </dt>
            <dd className="mt-1 font-semibold">{ticket.event.organizer.name}</dd>
          </div>
        </dl>
      </div>

      {/* The warning that does the real work */}
      <div className="mt-5 rounded-card border border-ink-700 bg-ink-900 p-5">
        <p className="text-sm font-bold uppercase tracking-luxe text-crimson-hover">
          This page grants no entry
        </p>
        <ul className="mt-3 space-y-2 text-sm text-ink-300">
          <li>
            Entry needs a code that refreshes every 30 seconds inside the
            holder&apos;s own Degis account. It only appears 2 hours before doors.
          </li>
          <li>
            Screenshots and photos of any Degis ticket will not scan at the gate.
          </li>
          <li>
            Buying from a stranger is not safe: the phone number above is who this
            ticket belongs to. If it is not yours, you will not get in.
          </li>
          <li>
            The safe way to receive a ticket is a transfer inside Degis, which
            moves it to your account.
          </li>
        </ul>
      </div>

      <p className="mt-6 text-center text-xs text-ink-500">
        Verified at {new Date().toLocaleString("en-GB", { timeZone: "Africa/Addis_Ababa" })} ·
        degis-tickets.vercel.app
      </p>
    </div>
  );
}
