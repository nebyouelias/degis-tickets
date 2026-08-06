import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ENTRY_OPENS_HOURS_BEFORE,
  entryIsOpen,
  entryOpensAt,
  maskForGate,
} from "@/lib/ticket-crypto";
import { formatEventDateTime } from "@/lib/format";
import { TicketEntryCode } from "@/components/TicketEntryCode";
import { TransferTicket } from "@/components/TransferTicket";

export const dynamic = "force-dynamic";

const GOLD_KINDS = new Set(["VIP", "VVIP", "TABLE"]);

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: {
      tier: true,
      event: { include: { venue: true, organizer: true } },
      order: true,
    },
  });

  const ownerId = ticket.ownerId ?? ticket.order.userId;
  if (!ticket || ownerId !== user.id) notFound();

  const gold = GOLD_KINDS.has(ticket.tier.kind);
  const isOpen = entryIsOpen(ticket.event.startsAt);
  const opensAt = entryOpensAt(ticket.event.startsAt);

  // Pre-activation: the QR points at the public verification page.
  // Deliberately NOT an entry credential — a buyer can scan it to check that a
  // ticket being offered to them is real and whose it is.
  const passQr = !isOpen
    ? await QRCode.toString(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://degis-tickets.vercel.app"}/t/${ticket.id}`,
        {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          color: { dark: "#55555F", light: "#1A1A1F" },
        }
      )
    : null;

  const statusView = {
    VALID: { label: "Valid", cls: "border-gold/40 bg-gold-faint text-gold" },
    CHECKED_IN: {
      label: "Checked in",
      cls: "border-ink-500 bg-ink-800 text-ink-300",
    },
    VOID: {
      label: "Void",
      cls: "border-crimson/40 bg-crimson-muted/40 text-ink-100",
    },
  }[ticket.status];

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <div
        className={`overflow-hidden rounded-card border bg-ink-900 shadow-card ${
          gold ? "border-gold/30" : "border-ink-700"
        }`}
      >
        {/* Stub header */}
        <div className={`px-6 py-5 ${gold ? "bg-gold-faint/60" : "bg-ink-800"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-ethiopic text-lg text-gold">ድግስ</p>
              <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
                Degis Tickets
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusView.cls}`}
            >
              {statusView.label}
            </span>
          </div>
          <h1 className="mt-4 text-xl font-extrabold leading-snug">
            {ticket.event.title}
          </h1>
          <p className="mt-1 text-sm text-ink-300">
            {formatEventDateTime(ticket.event.startsAt)}
          </p>
          <p className="text-sm text-ink-300">
            {ticket.event.venue.name}
            {ticket.event.venue.address ? `, ${ticket.event.venue.address}` : ""}
          </p>
        </div>

        {/* Perforation */}
        <div className="relative h-6 bg-ink-900">
          <div className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-ink-950" />
          <div className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-ink-950" />
          <div className="absolute left-4 right-4 top-3 border-t border-dashed border-ink-700" />
        </div>

        <div className="px-6 pb-6">
          {ticket.status === "VOID" ? (
            <div className="rounded-2xl border border-crimson/40 bg-crimson-muted/40 p-6 text-center">
              <p className="font-semibold">This ticket was voided</p>
              <p className="mt-1 text-sm text-ink-300">
                Contact the organizer if you believe this is a mistake.
              </p>
            </div>
          ) : isOpen ? (
            /* ---------- STATE 2: live rotating entry code ---------- */
            <TicketEntryCode ticketId={ticket.id} gold={gold} />
          ) : (
            /* ---------- STATE 1: ticket pass, not an entry code ---------- */
            <div>
              <div className="rounded-2xl border border-ink-700 bg-ink-800 p-5">
                <div className="mx-auto w-full max-w-[180px] opacity-60">
                  <div
                    className="[&>svg]:h-auto [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: passQr ?? "" }}
                  />
                </div>
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-luxe text-ink-300">
                  Not an entry code
                </p>
                <p className="mt-1 text-center text-xs text-ink-500">
                  Scan to verify this ticket is genuine
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-gold/30 bg-gold-faint/40 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-luxe text-gold">
                  Entry code unlocks
                </p>
                <p className="mt-1 font-semibold">
                  {formatEventDateTime(opensAt)}
                </p>
                <p className="mt-1 text-xs text-ink-300">
                  {ENTRY_OPENS_HOURS_BEFORE} hours before doors. Open Degis then —
                  while you have signal — and your code works all night, even
                  offline.
                </p>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-2xl font-bold tracking-[0.2em]">
            {ticket.code}
          </p>
          <p className="mt-1 text-center text-xs text-ink-500">
            Show this code at the gate if your phone battery dies
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-ink-700 pt-5 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-luxe text-ink-500">
                Ticket type
              </dt>
              <dd className="mt-1 flex items-center gap-2 font-semibold">
                {ticket.tier.name}
                {gold && (
                  <span className="rounded-full border border-gold/40 bg-gold-faint px-2 py-0.5 text-[10px] font-bold text-gold">
                    {ticket.tier.kind}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-luxe text-ink-500">
                Held by
              </dt>
              <dd className="mt-1 font-mono font-semibold">
                {maskForGate(ticket.order.deliveryPhone)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {ticket.status === "VALID" && ticket.event.startsAt > new Date() && (
        <TransferTicket ticketId={ticket.id} eventTitle={ticket.event.title} />
      )}

      <div className="mt-8">
        <Link
          href="/tickets"
          className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-300 transition-colors hover:text-ink-100"
        >
          ← All tickets
        </Link>
      </div>
    </div>
  );
}
