import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizer, getOwnedEvent } from "@/lib/organizer";
import { EventEditForm } from "@/components/organizer/EventEditForm";

export const dynamic = "force-dynamic";

/** Format a Date as the yyyy-MM-ddTHH:mm that datetime-local expects, in Addis time. */
function toLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const { organizer } = await requireOrganizer();
  const event = await getOwnedEvent(params.id, organizer.id);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link
        href={`/organizer/events/${event.id}`}
        className="text-sm text-ink-300 transition-colors hover:text-ink-100"
      >
        ← Back to event
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Edit event</h1>
      <p className="mt-2 text-sm text-ink-300">
        Changes go live immediately. Buyers who already have tickets keep them.
      </p>

      <div className="mt-8">
        <EventEditForm
          event={{
            id: event.id,
            title: event.title,
            titleAm: event.titleAm ?? "",
            description: event.description,
            category: event.category,
            startsAtLocal: toLocalInput(event.startsAt),
            coverImage: event.coverImage,
            venueName: event.venue.name,
            venueAddress: event.venue.address ?? "",
            venueCity: event.venue.city,
            published: event.published,
            reviewStatus: event.reviewStatus,
            tiers: event.tiers.map((t) => ({
              id: t.id,
              name: t.name,
              kind: t.kind,
              priceEtb: String(t.priceEtb),
              capacity: String(t.capacity),
              sold: t.sold,
            })),
          }}
        />
      </div>
    </div>
  );
}
