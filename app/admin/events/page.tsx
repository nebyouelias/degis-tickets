import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { ActionButton } from "@/components/admin/ActionButtons";
import { formatEtb, formatEventDateTime } from "@/lib/format";
import type { EventReviewStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "DRAFT"] as const;

const badge: Record<string, string> = {
  PENDING_REVIEW: "border-gold/40 bg-gold-faint text-gold",
  APPROVED: "border-emerald-600/40 bg-emerald-950/40 text-emerald-400",
  REJECTED: "border-crimson/40 bg-crimson-muted/40 text-crimson-hover",
  DRAFT: "border-ink-700 bg-ink-800 text-ink-300",
};

export default async function AdminEvents({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdmin();

  const filter = STATUSES.includes(searchParams.status as EventReviewStatus)
    ? (searchParams.status as EventReviewStatus)
    : undefined;

  const events = await db.event.findMany({
    where: filter ? { reviewStatus: filter } : {},
    include: {
      organizer: true,
      venue: true,
      tiers: true,
      _count: { select: { tickets: true } },
    },
    orderBy: [{ reviewStatus: "asc" }, { startsAt: "asc" }],
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Degis admin
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Events</h1>
      <div className="mt-5">
        <AdminNav active="/admin/events" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/events"
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
            !filter ? "border-ink-500 text-ink-100" : "border-ink-700 text-ink-300"
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/events?status=${s}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              filter === s ? "border-ink-500 text-ink-100" : "border-ink-700 text-ink-300"
            }`}
          >
            {s.replace("_", " ").toLowerCase()}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No events in this view.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {events.map((event) => {
            const capacity = event.tiers.reduce((s, t) => s + t.capacity, 0);
            const sold = event.tiers.reduce((s, t) => s + t.sold, 0);
            const revenue = event.tiers.reduce(
              (s, t) => s + t.sold * t.priceEtb,
              0
            );
            return (
              <li
                key={event.id}
                className="rounded-card border border-ink-700 bg-ink-900 p-4"
              >
                <div className="flex flex-wrap gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-700">
                    <Image
                      src={event.coverImage}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {event.title}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge[event.reviewStatus]}`}
                      >
                        {event.reviewStatus.replace("_", " ")}
                      </span>
                      {event.published && (
                        <span className="rounded-full border border-emerald-600/40 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          LIVE
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-300">
                      {formatEventDateTime(event.startsAt)} · {event.venue.name}
                    </p>
                    <p className="text-xs text-ink-500">
                      {event.organizer.name}
                      {event.organizer.status !== "APPROVED" && (
                        <span className="text-crimson-hover">
                          {" "}
                          · organizer {event.organizer.status}
                        </span>
                      )}{" "}
                      · {sold}/{capacity} sold · {formatEtb(revenue)} ETB ·{" "}
                      {event._count.tickets} tickets
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-ink-700 pt-3">
                  <Link
                    href={`/events/${event.slug}`}
                    target="_blank"
                    className="rounded-full border border-ink-700 px-4 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:text-ink-100"
                  >
                    View page ↗
                  </Link>
                  {event.reviewStatus !== "APPROVED" && (
                    <ActionButton
                      endpoint="events"
                      payload={{ eventId: event.id, action: "approve" }}
                      label="Approve & publish"
                      tone="primary"
                    />
                  )}
                  {event.reviewStatus !== "REJECTED" && (
                    <ActionButton
                      endpoint="events"
                      payload={{ eventId: event.id, action: "reject" }}
                      label="Reject"
                      tone="danger"
                      withNote
                      confirm="Reject this event? It comes off sale."
                    />
                  )}
                  {event.published && (
                    <ActionButton
                      endpoint="events"
                      payload={{ eventId: event.id, action: "unpublish" }}
                      label="Unpublish"
                      confirm="Take this event off sale?"
                    />
                  )}
                </div>

                {event.reviewNote && (
                  <p className="mt-3 text-xs text-ink-500">
                    Note: {event.reviewNote}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
