import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { formatEtb, formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireAdmin();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    paidOrders,
    ordersToday,
    pendingOrganizers,
    pendingEvents,
    counts,
    stuckOrders,
    upcoming,
    recentLog,
  ] = await Promise.all([
    db.order.findMany({
      where: { status: "PAID" },
      select: { subtotalEtb: true, serviceFeeEtb: true, channel: true, paidAt: true },
    }),
    db.order.count({ where: { status: "PAID", paidAt: { gte: dayAgo } } }),
    db.organizer.count({ where: { status: "PENDING" } }),
    db.event.count({ where: { reviewStatus: "PENDING_REVIEW" } }),
    Promise.all([
      db.user.count(),
      db.organizer.count(),
      db.event.count(),
      db.ticket.count(),
    ]),
    db.order.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000), gte: weekAgo },
      },
    }),
    db.event.findMany({
      where: { published: true, startsAt: { gte: new Date() } },
      include: {
        organizer: true,
        venue: true,
        tiers: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const [userCount, organizerCount, eventCount, ticketCount] = counts;

  const gmv = paidOrders.reduce((s, o) => s + o.subtotalEtb, 0);
  const revenue = paidOrders.reduce((s, o) => s + o.serviceFeeEtb, 0);
  const gmvWeek = paidOrders
    .filter((o) => o.paidAt && o.paidAt >= weekAgo)
    .reduce((s, o) => s + o.subtotalEtb, 0);
  const boxOfficeShare = paidOrders.length
    ? Math.round(
        (paidOrders.filter((o) => o.channel === "BOX_OFFICE").length /
          paidOrders.length) *
          100
      )
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Degis admin
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Platform overview</h1>
      <div className="mt-5">
        <AdminNav active="/admin" />
      </div>

      {/* Needs attention */}
      {(pendingOrganizers > 0 || pendingEvents > 0 || stuckOrders > 0) && (
        <div className="mt-8 rounded-card border border-gold/30 bg-gold-faint/30 p-5">
          <p className="text-xs font-medium uppercase tracking-luxe text-gold">
            Needs attention
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {pendingOrganizers > 0 && (
              <Link
                href="/admin/organizers?status=PENDING"
                className="rounded-full bg-crimson px-4 py-2 text-sm font-semibold"
              >
                {pendingOrganizers} organizer
                {pendingOrganizers === 1 ? "" : "s"} awaiting review →
              </Link>
            )}
            {pendingEvents > 0 && (
              <Link
                href="/admin/events?status=PENDING_REVIEW"
                className="rounded-full bg-crimson px-4 py-2 text-sm font-semibold"
              >
                {pendingEvents} event{pendingEvents === 1 ? "" : "s"} awaiting
                review →
              </Link>
            )}
            {stuckOrders > 0 && (
              <span className="rounded-full border border-ink-700 px-4 py-2 text-sm text-ink-300">
                {stuckOrders} order{stuckOrders === 1 ? "" : "s"} stuck pending
                (check payments)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="GMV (all time)" value={`${formatEtb(gmv)} ETB`} gold />
        <Metric label="Degis revenue" value={`${formatEtb(revenue)} ETB`} gold />
        <Metric label="GMV last 7 days" value={`${formatEtb(gmvWeek)} ETB`} />
        <Metric label="Paid orders today" value={String(ordersToday)} />
        <Metric label="Users" value={String(userCount)} />
        <Metric label="Organizers" value={String(organizerCount)} />
        <Metric label="Events" value={String(eventCount)} />
        <Metric label="Tickets issued" value={String(ticketCount)} />
      </div>

      <p className="mt-3 text-xs text-ink-500">
        Box office accounts for {boxOfficeShare}% of paid orders — a key adoption
        signal for cash-first organizers.
      </p>

      {/* Live events */}
      <h2 className="mt-10 text-lg font-bold">Upcoming events on sale</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">Nothing on sale right now.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {upcoming.map((event) => {
            const capacity = event.tiers.reduce((s, t) => s + t.capacity, 0);
            const sold = event.tiers.reduce((s, t) => s + t.sold, 0);
            return (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-700 bg-ink-900 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{event.title}</p>
                  <p className="text-sm text-ink-300">
                    {formatEventDate(event.startsAt)} · {event.venue.name} ·{" "}
                    {event.organizer.name}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold">
                    {sold}
                    <span className="font-normal text-ink-500">/{capacity}</span>
                  </p>
                  <p className="text-xs text-ink-500">
                    {event._count.tickets} tickets
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Audit trail */}
      <h2 className="mt-10 text-lg font-bold">Recent admin activity</h2>
      {recentLog.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">No actions recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-700 rounded-card border border-ink-700 bg-ink-900">
          {recentLog.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-3 px-4 py-3 text-sm">
              <span className="font-mono text-xs text-ink-500">
                {entry.createdAt.toLocaleString("en-GB", {
                  timeZone: "Africa/Addis_Ababa",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <span className="font-semibold">{entry.action}</span>
              <span className="text-ink-300">
                {entry.targetType} · {entry.actorLabel}
              </span>
              {entry.note && (
                <span className="text-ink-500">— {entry.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}
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
      <p className={`mt-1.5 text-xl font-bold ${gold ? "text-gold" : ""}`}>
        {value}
      </p>
    </div>
  );
}
