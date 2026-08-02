import { db } from "@/lib/db";
import { EventCard } from "@/components/EventCard";

export const dynamic = "force-dynamic";

const categories = [
  { en: "Concerts", am: "ኮንሰርቶች", q: "concert" },
  { en: "Football", am: "እግር ኳስ", q: "football" },
  { en: "Festivals", am: "በዓላት", q: "festival" },
  { en: "Nightlife", am: "የምሽት ህይወት", q: "nightlife" },
  { en: "Comedy", am: "ኮሜዲ", q: "comedy" },
  { en: "Conferences", am: "ጉባኤዎች", q: "conference" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() ?? "";

  const events = await db.event.findMany({
    where: {
      published: true,
      reviewStatus: "APPROVED",
      organizer: { is: { status: "APPROVED" } },
      startsAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { titleAm: { contains: q } },
              { category: { in: matchCategories(q) } },
              { venue: { is: { name: { contains: q, mode: "insensitive" } } } },
              {
                organizer: {
                  is: { name: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    },
    include: { venue: true, tiers: true },
    orderBy: { startsAt: "asc" },
    take: 24,
  });

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

          <form
            action="/"
            className="mx-auto mt-8 flex max-w-xl items-center rounded-full border border-ink-700 bg-ink-900 p-1.5 pl-5 shadow-card"
          >
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search events, artists, venues…"
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-crimson px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-crimson-hover"
            >
              Search
            </button>
          </form>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {categories.map((c) => (
              <a
                key={c.en}
                href={`/?q=${c.q}`}
                className="rounded-full border border-ink-700 bg-ink-900 px-4 py-1.5 text-sm text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
              >
                {c.en}{" "}
                <span className="font-ethiopic text-ink-500">{c.am}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
              {q ? "Search results" : "Trending"}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {q ? `Events matching “${q}”` : "This week in Addis"}
            </h2>
          </div>
          {q && (
            <a href="/" className="text-sm text-ink-300 hover:text-ink-100">
              Clear search
            </a>
          )}
        </div>

        {events.length === 0 ? (
          <div className="rounded-card border border-ink-700 bg-ink-900 px-6 py-16 text-center">
            <p className="font-ethiopic text-2xl text-gold">ድ</p>
            <p className="mt-3 font-semibold text-ink-100">
              {q ? "No events match that search." : "No events yet."}
            </p>
            <p className="mt-1 text-sm text-ink-300">
              {q
                ? "Try a different name, venue, or category."
                : "The catalog is empty — seed the database to load launch events."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function matchCategories(q: string) {
  const needle = q.toLowerCase();
  const all = [
    "CONCERT",
    "FOOTBALL",
    "FESTIVAL",
    "NIGHTLIFE",
    "COMEDY",
    "CONFERENCE",
    "CULTURAL",
    "CHURCH",
  ] as const;
  return all.filter((c) => c.toLowerCase().includes(needle));
}
