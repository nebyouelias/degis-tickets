import Image from "next/image";
import Link from "next/link";
import type { Event, TicketTier, Venue } from "@prisma/client";
import { categoryLabels, formatEtb, formatEventDate } from "@/lib/format";

export type EventCardData = Event & { venue: Venue; tiers: TicketTier[] };

export function EventCard({ event }: { event: EventCardData }) {
  const prices = event.tiers.map((t) => t.priceEtb);
  const priceFrom = prices.length ? Math.min(...prices) : null;
  const hasVip = event.tiers.some((t) =>
    ["VIP", "VVIP", "TABLE"].includes(t.kind)
  );
  const soldOut =
    event.tiers.length > 0 && event.tiers.every((t) => t.sold >= t.capacity);

  return (
    <Link href={`/events/${event.slug}`} className="block">
      <article
        className={`group overflow-hidden rounded-card border bg-ink-800 transition-transform duration-300 hover:-translate-y-1 ${
          hasVip ? "border-gold/25 shadow-vip" : "border-ink-700 shadow-card"
        }`}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={event.coverImage}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium text-ink-100 backdrop-blur">
              {categoryLabels[event.category]}
            </span>
            {hasVip && !soldOut && (
              <span className="rounded-full border border-gold/40 bg-gold-faint px-3 py-1 text-xs font-semibold tracking-wide text-gold">
                VIP tables
              </span>
            )}
            {soldOut && (
              <span className="rounded-full bg-crimson-muted px-3 py-1 text-xs font-semibold text-crimson-hover">
                Sold out
              </span>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-xs font-medium uppercase tracking-luxe text-ink-300">
              {formatEventDate(event.startsAt)} · {event.venue.name}
            </p>
            <h3 className="mt-1 text-lg font-bold leading-snug text-ink-100">
              {event.title}
            </h3>
            {event.titleAm && (
              <p className="font-ethiopic text-sm text-ink-300">{event.titleAm}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <p className="text-sm text-ink-300">
            {priceFrom !== null ? (
              <>
                From{" "}
                <span className="font-semibold text-ink-100">
                  {formatEtb(priceFrom)} ETB
                </span>
              </>
            ) : (
              "Details soon"
            )}
          </p>
          <span className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-100 transition-colors group-hover:border-crimson group-hover:bg-crimson">
            {soldOut ? "View event" : "Get tickets"}
          </span>
        </div>
      </article>
    </Link>
  );
}
