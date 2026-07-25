import Image from "next/image";
import { DegisEvent, formatEtb, formatEventDate } from "@/lib/sample-events";

export function EventCard({ event }: { event: DegisEvent }) {
  return (
    <article
      className={`group overflow-hidden rounded-card border bg-ink-800 transition-transform duration-300 hover:-translate-y-1 ${
        event.vip ? "border-gold/25 shadow-vip" : "border-ink-700 shadow-card"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={event.image}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium text-ink-100 backdrop-blur">
            {event.category}
          </span>
          {event.vip && (
            <span className="rounded-full border border-gold/40 bg-gold-faint px-3 py-1 text-xs font-semibold tracking-wide text-gold">
              VIP tables
            </span>
          )}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-medium uppercase tracking-luxe text-ink-300">
            {formatEventDate(event.date)} · {event.venue}
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
          From{" "}
          <span className="font-semibold text-ink-100">
            {formatEtb(event.priceFromEtb)} ETB
          </span>
        </p>
        <button
          type="button"
          className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-100 transition-colors group-hover:border-crimson group-hover:bg-crimson"
        >
          Get tickets
        </button>
      </div>
    </article>
  );
}
