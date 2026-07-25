import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EventCategory, TierKind } from "@prisma/client";

export const dynamic = "force-dynamic";

// One-time browser-triggered seeding (no local setup needed).
// Visit: /api/seed?secret=YOUR_SEED_SECRET
// Idempotent: safe to run more than once.

const seedData: Array<{
  slug: string;
  title: string;
  titleAm?: string;
  category: EventCategory;
  startsAt: string;
  coverImage: string;
  description: string;
  venue: { name: string; address?: string };
  tiers: Array<{ name: string; kind: TierKind; priceEtb: number; capacity: number }>;
}> = [
  {
    slug: "meskel-square-concert",
    title: "New Year Concert at Meskel Square",
    titleAm: "የአዲስ ዓመት ኮንሰርት",
    category: "CONCERT",
    startsAt: "2026-09-11T18:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=70",
    description:
      "Ring in Enkutatash with the biggest night of the year. Live performances under the Addis sky, food, and a midnight celebration at the heart of the city.",
    venue: { name: "Meskel Square", address: "Churchill Ave" },
    tiers: [
      { name: "General Admission", kind: "GA", priceEtb: 800, capacity: 5000 },
      { name: "Early Bird", kind: "EARLY_BIRD", priceEtb: 600, capacity: 1000 },
      { name: "VIP Front Stage", kind: "VIP", priceEtb: 2500, capacity: 400 },
      { name: "VVIP Lounge", kind: "VVIP", priceEtb: 6000, capacity: 80 },
    ],
  },
  {
    slug: "sheger-comedy-night",
    title: "Sheger Comedy Night",
    titleAm: "የሸገር ኮሜዲ ምሽት",
    category: "COMEDY",
    startsAt: "2026-08-14T20:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=1600&q=70",
    description:
      "An evening of stand-up from Addis Ababa's sharpest comedians. Doors at 7:30, show at 8. Dinner and drinks available.",
    venue: { name: "Hyatt Regency", address: "Meskel Square" },
    tiers: [
      { name: "Standard Seat", kind: "GA", priceEtb: 500, capacity: 300 },
      { name: "VIP Table (4 seats)", kind: "TABLE", priceEtb: 4000, capacity: 20 },
    ],
  },
  {
    slug: "addis-derby",
    title: "Addis Derby — St. George vs Ethiopia Bunna",
    titleAm: "የአዲስ ደርቢ",
    category: "FOOTBALL",
    startsAt: "2026-08-22T15:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1600&q=70",
    description:
      "The oldest rivalry in Ethiopian football. Kickoff 3 PM — arrive early, gates open at 1 PM.",
    venue: { name: "Addis Ababa Stadium" },
    tiers: [
      { name: "General Stand", kind: "GA", priceEtb: 150, capacity: 15000 },
      { name: "Covered Stand", kind: "VIP", priceEtb: 400, capacity: 3000 },
    ],
  },
  {
    slug: "rooftop-sessions",
    title: "Rooftop Sessions — Bole",
    category: "NIGHTLIFE",
    startsAt: "2026-08-08T21:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&q=70",
    description:
      "House and Ethio-groove on the Sky Lounge rooftop. 21+, dress code enforced.",
    venue: { name: "Sky Lounge", address: "Bole" },
    tiers: [
      { name: "Entry", kind: "GA", priceEtb: 600, capacity: 350 },
      { name: "Lounge Table + Bottle", kind: "TABLE", priceEtb: 8000, capacity: 12 },
    ],
  },
  {
    slug: "irreecha-festival",
    title: "Irreecha Festival Gathering",
    category: "FESTIVAL",
    startsAt: "2026-10-03T08:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=70",
    description:
      "Celebrate the thanksgiving festival with music, culture, and community at Hora Finfinne.",
    venue: { name: "Hora Finfinne" },
    tiers: [{ name: "Entry", kind: "GA", priceEtb: 200, capacity: 10000 }],
  },
  {
    slug: "tech-summit-addis",
    title: "Addis Tech Summit 2026",
    category: "CONFERENCE",
    startsAt: "2026-11-05T09:00:00+03:00",
    coverImage:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=70",
    description:
      "Two days of talks and workshops with founders, engineers, and investors building Ethiopia's tech future.",
    venue: { name: "Millennium Hall", address: "Bole Road" },
    tiers: [
      { name: "Standard Pass", kind: "GA", priceEtb: 1200, capacity: 2000 },
      { name: "Student Pass", kind: "STUDENT", priceEtb: 500, capacity: 500 },
      { name: "VIP Pass", kind: "VIP", priceEtb: 4500, capacity: 200 },
    ],
  },
];

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizer = await db.organizer.upsert({
    where: { slug: "degis-official" },
    update: {},
    create: { slug: "degis-official", name: "Degis Official", verified: true },
  });

  let created = 0;
  for (const item of seedData) {
    const existing = await db.event.findUnique({ where: { slug: item.slug } });
    if (existing) continue;

    let venue = await db.venue.findFirst({ where: { name: item.venue.name } });
    if (!venue) {
      venue = await db.venue.create({
        data: {
          name: item.venue.name,
          address: item.venue.address,
          city: "Addis Ababa",
        },
      });
    }

    await db.event.create({
      data: {
        slug: item.slug,
        title: item.title,
        titleAm: item.titleAm,
        description: item.description,
        category: item.category,
        startsAt: new Date(item.startsAt),
        coverImage: item.coverImage,
        organizerId: organizer.id,
        venueId: venue.id,
        tiers: {
          create: item.tiers.map((t, i) => ({ ...t, sortOrder: i })),
        },
      },
    });
    created++;
  }

  return NextResponse.json({
    seeded: true,
    eventsCreated: created,
    note: created === 0 ? "Catalog already seeded — nothing to do." : "Done.",
  });
}
