import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMyOrganizer, slugify } from "@/lib/organizer";
import type { EventCategory, TierKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "CONCERT",
  "FOOTBALL",
  "FESTIVAL",
  "NIGHTLIFE",
  "COMEDY",
  "CONFERENCE",
  "CULTURAL",
  "CHURCH",
  "OTHER",
] as const;

const TIER_KINDS = [
  "GA",
  "VIP",
  "VVIP",
  "EARLY_BIRD",
  "STUDENT",
  "TABLE",
] as const;

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=70";

type TierInput = {
  name?: string;
  kind?: string;
  priceEtb?: number;
  capacity?: number;
};

export async function POST(request: Request) {
  const { user, organizer } = await getMyOrganizer();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!organizer) {
    return NextResponse.json(
      { error: "Create your organizer profile first." },
      { status: 403 }
    );
  }

  let body: {
    title?: string;
    titleAm?: string;
    description?: string;
    category?: string;
    startsAt?: string;
    coverImage?: string;
    venueName?: string;
    venueAddress?: string;
    venueCity?: string;
    published?: boolean;
    tiers?: TierInput[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (title.length < 3) {
    return NextResponse.json({ error: "Add an event title." }, { status: 400 });
  }

  const category = CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])
    ? (body.category as EventCategory)
    : "OTHER";

  const startsAt = new Date(body.startsAt ?? "");
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json(
      { error: "Add a valid date and time." },
      { status: 400 }
    );
  }

  const venueName = (body.venueName ?? "").trim();
  if (venueName.length < 2) {
    return NextResponse.json({ error: "Add a venue name." }, { status: 400 });
  }

  const rawTiers = (body.tiers ?? []).filter((t) => (t.name ?? "").trim());
  if (rawTiers.length === 0) {
    return NextResponse.json(
      { error: "Add at least one ticket type." },
      { status: 400 }
    );
  }

  const tiers = rawTiers.map((t, i) => {
    const price = Math.round(Number(t.priceEtb));
    const capacity = Math.round(Number(t.capacity));
    return {
      name: (t.name ?? "").trim().slice(0, 60),
      kind: (TIER_KINDS.includes(t.kind as (typeof TIER_KINDS)[number])
        ? t.kind
        : "GA") as TierKind,
      priceEtb: Number.isFinite(price) && price >= 0 ? price : 0,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 1,
      sortOrder: i,
    };
  });

  // Reuse an existing venue with the same name/city to keep the venue list clean
  const city = (body.venueCity ?? "Addis Ababa").trim() || "Addis Ababa";
  let venue = await db.venue.findFirst({ where: { name: venueName, city } });
  if (!venue) {
    venue = await db.venue.create({
      data: {
        name: venueName,
        city,
        address: (body.venueAddress ?? "").trim() || null,
      },
    });
  }

  const event = await db.event.create({
    data: {
      slug: slugify(title),
      title: title.slice(0, 140),
      titleAm: (body.titleAm ?? "").trim().slice(0, 140) || null,
      description: (body.description ?? "").trim().slice(0, 4000),
      category,
      startsAt,
      coverImage: (body.coverImage ?? "").trim() || FALLBACK_COVER,
      published: body.published !== false,
      organizerId: organizer.id,
      venueId: venue.id,
      tiers: { create: tiers },
    },
  });

  return NextResponse.json({ ok: true, eventId: event.id, slug: event.slug });
}
