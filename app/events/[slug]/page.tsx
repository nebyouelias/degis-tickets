import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { releaseExpiredOrders } from "@/lib/inventory";
import { categoryLabels, formatEventDateTime } from "@/lib/format";
import { TicketSelector } from "@/components/TicketSelector";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
}: {
  params: { slug: string };
}) {
  const [user, event] = await Promise.all([
    getCurrentUser(),
    db.event.findUnique({
      where: { slug: params.slug },
      include: {
        venue: true,
        organizer: true,
        tiers: { orderBy: [{ sortOrder: "asc" }, { priceEtb: "asc" }] },
      },
    }),
  ]);

  if (!event || !event.published) notFound();

  // Free stale holds so availability shown is accurate
  await releaseExpiredOrders(event.id);
  const tiers = await db.ticketTier.findMany({
    where: { eventId: event.id },
    orderBy: [{ sortOrder: "asc" }, { priceEtb: "asc" }],
  });

  const soldOut = tiers.length > 0 && tiers.every((t) => t.sold >= t.capacity);

  return (
    <article className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <div className="relative aspect-[16/7] overflow-hidden rounded-card border border-ink-700">
        <Image
          src={event.coverImage}
          alt={event.title}
          fill
          priority
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium backdrop-blur">
              {categoryLabels[event.category]}
            </span>
            {soldOut && (
              <span className="rounded-full bg-crimson px-3 py-1 text-xs font-semibold">
                Sold out
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
            {event.title}
          </h1>
          {event.titleAm && (
            <p className="mt-1 font-ethiopic text-lg text-ink-300">
              {event.titleAm}
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
              <dt className="text-xs font-medium uppercase tracking-luxe text-ink-500">
                Date &amp; time
              </dt>
              <dd className="mt-1.5 font-semibold">
                {formatEventDateTime(event.startsAt)}
              </dd>
            </div>
            <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
              <dt className="text-xs font-medium uppercase tracking-luxe text-ink-500">
                Venue
              </dt>
              <dd className="mt-1.5 font-semibold">
                {event.venue.name}
                <span className="block text-sm font-normal text-ink-300">
                  {event.venue.address ? `${event.venue.address}, ` : ""}
                  {event.venue.city}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-5">
            <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
              Organizer
            </p>
            <p className="mt-1.5 flex items-center gap-2 font-semibold">
              {event.organizer.name}
              {event.organizer.verified && (
                <span className="rounded-full border border-gold/40 bg-gold-faint px-2.5 py-0.5 text-xs font-semibold text-gold">
                  Verified
                </span>
              )}
            </p>
          </div>

          {event.description && (
            <div className="mt-6">
              <h2 className="text-lg font-bold">About this event</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-300">
                {event.description}
              </p>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-card border border-ink-700 bg-ink-900 p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Tickets</h2>
          <TicketSelector
            eventId={event.id}
            signedIn={Boolean(user)}
            needsPhone={Boolean(user && !user.phone)}
            tiers={tiers.map((t) => ({
              id: t.id,
              name: t.name,
              kind: t.kind,
              priceEtb: t.priceEtb,
              remaining: Math.max(t.capacity - t.sold, 0),
            }))}
          />
        </aside>
      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm text-ink-300 hover:text-ink-100">
          ← All events
        </Link>
      </div>
    </article>
  );
}
