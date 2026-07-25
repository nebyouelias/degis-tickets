import { EventCard } from "@/components/EventCard";
import { sampleEvents } from "@/lib/sample-events";

const categories = [
  { en: "Concerts", am: "ኮንሰርቶች" },
  { en: "Football", am: "እግር ኳስ" },
  { en: "Festivals", am: "በዓላት" },
  { en: "Nightlife", am: "የምሽት ህይወት" },
  { en: "Comedy", am: "ኮሜዲ" },
  { en: "Conferences", am: "ጉባኤዎች" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-crimson-muted/50 blur-[140px]"
        />
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center md:pt-28">
          <p className="font-ethiopic text-lg text-gold">ድግስ</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Every celebration.
            <br />
            One ticket home.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-300 md:text-lg">
            Concerts, football, festivals and nightlife across Ethiopia —
            verified tickets, paid with Telebirr, delivered to your phone.
          </p>

          {/* Search (wired in Phase 1) */}
          <div className="mx-auto mt-8 flex max-w-xl items-center rounded-full border border-ink-700 bg-ink-900 p-1.5 pl-5 shadow-card">
            <input
              type="text"
              placeholder="Search events, artists, venues…"
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
              disabled
            />
            <button
              type="button"
              className="shrink-0 rounded-full bg-crimson px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-crimson-hover"
            >
              Search
            </button>
          </div>

          {/* Categories */}
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {categories.map((c) => (
              <span
                key={c.en}
                className="cursor-pointer rounded-full border border-ink-700 bg-ink-900 px-4 py-1.5 text-sm text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
              >
                {c.en} <span className="font-ethiopic text-ink-500">{c.am}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
              Trending
            </p>
            <h2 className="mt-1 text-2xl font-bold">This week in Addis</h2>
          </div>
          <span className="text-sm text-ink-500">Live catalog arrives in Phase 1</span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sampleEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </>
  );
}
