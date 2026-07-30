import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/organizer";
import { formatEtb, formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboard() {
  const { organizer } = await requireOrganizer();

  const [events, paidOrders, ticketStats] = await Promise.all([
    db.event.findMany({
      where: { organizerId: organizer.id },
      include: { venue: true, tiers: true, _count: { select: { tickets: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.order.findMany({
      where: { event: { organizerId: organizer.id }, status: "PAID" },
      select: { subtotalEtb: true, channel: true },
    }),
    db.ticket.groupBy({
      by: ["status"],
      where: { event: { organizerId: organizer.id } },
      _count: { _all: true },
    }),
  ]);

  const revenue = paidOrders.reduce((s, o) => s + o.subtotalEtb, 0);
  const onlineRevenue = paidOrders
    .filter((o) => o.channel === "ONLINE")
    .reduce((s, o) => s + o.subtotalEtb, 0);
  const boxOfficeRevenue = revenue - onlineRevenue;
  const ticketsIssued = ticketStats.reduce((s, g) => s + g._count._all, 0);
  const checkedIn =
    ticketStats.find((g) => g.status === "CHECKED_IN")?._count._all ?? 0;

  const now = new Date();
  const upcoming = events.filter((e) => e.startsAt >= now);
  const past = events.filter((e) => e.startsAt < now);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
            Organizer
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold">
            {organizer.name}
            {organizer.verified ? (
              <span className="rounded-full border border-gold/40 bg-gold-faint px-2.5 py-0.5 text-xs font-semibold text-gold">
                Verified
              </span>
            ) : (
              <span className="rounded-full border border-ink-700 bg-ink-800 px-2.5 py-0.5 text-xs font-semibold text-ink-300">
                Pending review
              </span>
            )}
          </h1>
        </div>
        <Link
          href="/organizer/events/new"
          className="rounded-full bg-crimson px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-crimson-hover"
        >
          + Create event
        </Link>
      </div>

      {/* Metrics */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Your revenue" value={`${formatEtb(revenue)} ETB`} gold />
        <Metric label="Tickets issued" value={String(ticketsIssued)} />
        <Metric
          label="Checked in"
          value={
            ticketsIssued > 0
              ? `${checkedIn} · ${Math.round((checkedIn / ticketsIssued) * 100)}%`
              : "0"
          }
        />
        <Metric label="Events" value={String(events.length)} />
      </div>

      {revenue > 0 && (
        <div className="mt-3 rounded-card border border-ink-700 bg-ink-900 p-5">
          <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
            Sales by channel
          </p>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="bg-crimson"
              style={{ width: `${(onlineRevenue / revenue) * 100}%` }}
            />
            <div
              className="bg-gold"
              style={{ width: `${(boxOfficeRevenue / revenue) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <span className="flex items-center gap-2 text-ink-300">
              <span className="h-2 w-2 rounded-full bg-crimson" />
              Online {formatEtb(onlineRevenue)} ETB
            </span>
            <span className="flex items-center gap-2 text-ink-300">
              <span className="h-2 w-2 rounded-full bg-gold" />
              Box office {formatEtb(boxOfficeRevenue)} ETB
            </span>
          </div>
        </div>
      )}

      {/* Events */}
      <h2 className="mt-10 text-lg font-bold">Upcoming events</h2>
      {upcoming.length === 0 ? (
        <div className="mt-4 rounded-card border border-ink-700 bg-ink-900 p-10 text-center">
          <p className="font-ethiopic text-2xl text-gold">ድ</p>
          <p className="mt-3 font-semibold">No upcoming events</p>
          <p className="mt-1 text-sm text-ink-300">
            Create your first event and start selling in minutes.
          </p>
          <Link
            href="/organizer/events/new"
            className="mt-5 inline-block rounded-full bg-crimson px-5 py-2 text-sm font-semibold transition-colors hover:bg-crimson-hover"
          >
            + Create event
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Past events</h2>
          <ul className="mt-4 space-y-3 opacity-70">
            {past.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </>
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
      <p
        className={`mt-1.5 text-xl font-bold ${gold ? "text-gold" : "text-ink-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

type EventRowData = {
  id: string;
  title: string;
  startsAt: Date;
  coverImage: string;
  published: boolean;
  venue: { name: string };
  tiers: Array<{ capacity: number; sold: number }>;
  _count: { tickets: number };
};

function EventRow({ event }: { event: EventRowData }) {
  const capacity = event.tiers.reduce((s, t) => s + t.capacity, 0);
  const sold = event.tiers.reduce((s, t) => s + t.sold, 0);
  const pct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;

  return (
    <li>
      <Link
        href={`/organizer/events/${event.id}`}
        className="flex items-center gap-4 rounded-card border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-500"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink-700">
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold">
            {event.title}
            {!event.published && (
              <span className="shrink-0 rounded-full border border-ink-700 bg-ink-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-300">
                Draft
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ink-300">
            {formatEventDate(event.startsAt)} · {event.venue.name}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full bg-crimson"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold">
            {sold}
            <span className="text-sm font-normal text-ink-500">/{capacity}</span>
          </p>
          <p className="text-xs text-ink-500">{pct}% sold</p>
        </div>
      </Link>
    </li>
  );
}
