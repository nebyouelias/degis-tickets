import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer, getOwnedEvent } from "@/lib/organizer";
import { formatEtb, formatEventDateTime } from "@/lib/format";
import { releaseExpiredOrders } from "@/lib/inventory";
import { BoxOfficePanel } from "@/components/organizer/BoxOfficePanel";
import { ScannerPanel } from "@/components/organizer/ScannerPanel";
import { SalesChart } from "@/components/organizer/SalesChart";

export const dynamic = "force-dynamic";

const GOLD_KINDS = new Set(["VIP", "VVIP", "TABLE"]);

export default async function OrganizerEventPage({
  params,
}: {
  params: { id: string };
}) {
  const { organizer } = await requireOrganizer();

  const event = await getOwnedEvent(params.id, organizer.id);
  if (!event) notFound();

  // Release stale holds so the numbers shown are real
  await releaseExpiredOrders(event.id);

  const [tiers, paidOrders, tickets, recentTickets, devices] = await Promise.all([
    db.ticketTier.findMany({
      where: { eventId: event.id },
      orderBy: [{ sortOrder: "asc" }, { priceEtb: "asc" }],
    }),
    db.order.findMany({
      where: { eventId: event.id, status: "PAID" },
      select: { subtotalEtb: true, channel: true, paidAt: true },
    }),
    db.ticket.groupBy({
      by: ["status"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
    db.ticket.findMany({
      where: { eventId: event.id },
      include: { tier: true, order: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.scannerDevice.findMany({
      where: { eventId: event.id },
      include: { _count: { select: { scans: true } } },
      orderBy: [{ gate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const revenue = paidOrders.reduce((s, o) => s + o.subtotalEtb, 0);
  const boxOfficeRevenue = paidOrders
    .filter((o) => o.channel === "BOX_OFFICE")
    .reduce((s, o) => s + o.subtotalEtb, 0);
  const ticketsIssued = tickets.reduce((s, g) => s + g._count._all, 0);
  const checkedIn =
    tickets.find((g) => g.status === "CHECKED_IN")?._count._all ?? 0;
  const capacity = tiers.reduce((s, t) => s + t.capacity, 0);
  const sold = tiers.reduce((s, t) => s + t.sold, 0);

  // Last 14 days of sales
  const days: Array<{ label: string; etb: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const etb = paidOrders
      .filter((o) => o.paidAt && o.paidAt >= day && o.paidAt < next)
      .reduce((s, o) => s + o.subtotalEtb, 0);
    days.push({
      label: day.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      etb,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/organizer"
        className="text-sm text-ink-300 transition-colors hover:text-ink-100"
      >
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold md:text-3xl">
            {event.title}
            {!event.published && (
              <span className="rounded-full border border-ink-700 bg-ink-800 px-2.5 py-0.5 text-xs font-semibold uppercase text-ink-300">
                Draft
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-ink-300">
            {formatEventDateTime(event.startsAt)} · {event.venue.name}
          </p>
        </div>
        <Link
          href={`/events/${event.slug}`}
          target="_blank"
          className="rounded-full border border-ink-700 px-4 py-2 text-sm font-medium text-ink-300 transition-colors hover:border-gold/40 hover:text-ink-100"
        >
          View public page ↗
        </Link>
      </div>

      {/* Metrics */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Revenue" value={`${formatEtb(revenue)} ETB`} gold />
        <Metric
          label="Tickets sold"
          value={`${sold}${capacity ? ` / ${capacity}` : ""}`}
        />
        <Metric
          label="Checked in"
          value={
            ticketsIssued
              ? `${checkedIn} · ${Math.round((checkedIn / ticketsIssued) * 100)}%`
              : "0"
          }
        />
        <Metric label="Box office" value={`${formatEtb(boxOfficeRevenue)} ETB`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Sales chart */}
          <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
            <h2 className="font-bold">Sales · last 14 days</h2>
            <div className="mt-4">
              <SalesChart days={days} />
            </div>
          </section>

          {/* Tier breakdown */}
          <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
            <h2 className="font-bold">Ticket types</h2>
            <ul className="mt-4 space-y-3">
              {tiers.map((tier) => {
                const gold = GOLD_KINDS.has(tier.kind);
                const pct =
                  tier.capacity > 0
                    ? Math.round((tier.sold / tier.capacity) * 100)
                    : 0;
                return (
                  <li key={tier.id}>
                    <div className="flex items-baseline justify-between">
                      <p className="flex items-center gap-2 font-semibold">
                        {tier.name}
                        {gold && (
                          <span className="rounded-full border border-gold/40 bg-gold-faint px-2 py-0.5 text-[10px] font-bold text-gold">
                            {tier.kind}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-ink-300">
                        {tier.sold}/{tier.capacity} ·{" "}
                        {formatEtb(tier.sold * tier.priceEtb)} ETB
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className={`h-full ${gold ? "bg-gold" : "bg-crimson"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Attendees */}
          <section className="rounded-card border border-ink-700 bg-ink-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">Attendees</h2>
              <a
                href={`/api/organizer/events/${event.id}/attendees`}
                className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-300 transition-colors hover:border-gold/40 hover:text-ink-100"
              >
                Export CSV
              </a>
            </div>

            {recentTickets.length === 0 ? (
              <p className="mt-4 text-sm text-ink-300">
                No tickets issued yet. Sales appear here in real time.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-luxe text-ink-500">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Code</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700">
                    {recentTickets.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 pr-4 font-mono">{t.code}</td>
                        <td className="py-2.5 pr-4 text-ink-300">{t.tier.name}</td>
                        <td className="py-2.5 pr-4 text-ink-300">
                          {t.order.deliveryPhone || "—"}
                          {t.order.channel === "BOX_OFFICE" && (
                            <span className="ml-2 rounded-full border border-gold/30 bg-gold-faint px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                              CASH
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {t.status === "CHECKED_IN" ? (
                            <span className="text-gold">Checked in</span>
                          ) : t.status === "VOID" ? (
                            <span className="text-ink-500">Void</span>
                          ) : (
                            <span className="text-ink-300">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ticketsIssued > recentTickets.length && (
                  <p className="mt-3 text-xs text-ink-500">
                    Showing the latest {recentTickets.length} of {ticketsIssued}.
                    Export the CSV for the full door list.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Box office */}
        <aside className="h-fit rounded-card border border-gold/25 bg-ink-900 p-6 lg:sticky lg:top-24">
          <h2 className="font-bold">Box office</h2>
          <p className="mt-1 text-sm text-ink-300">
            Record a cash or transfer sale and issue tickets on the spot.
          </p>
          <div className="mt-4">
            <BoxOfficePanel
              eventId={event.id}
              tiers={tiers.map((t) => ({
                id: t.id,
                name: t.name,
                kind: t.kind,
                priceEtb: t.priceEtb,
                remaining: Math.max(t.capacity - t.sold, 0),
              }))}
            />
          </div>

          <div className="mt-8 border-t border-ink-700 pt-6">
            <h2 className="font-bold">Door scanners</h2>
            <p className="mt-1 text-sm text-ink-300">
              Pair a phone per gate. Each works fully offline once paired.
            </p>
            <div className="mt-4">
              <ScannerPanel
                eventId={event.id}
                devices={devices.map((d) => ({
                  id: d.id,
                  gate: d.gate,
                  label: d.label,
                  active: d.active,
                  lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
                  scanCount: d._count.scans,
                }))}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-5 ${
        gold ? "border-gold/25 bg-gold-faint/40" : "border-ink-700 bg-ink-900"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-bold ${gold ? "text-gold" : "text-ink-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
