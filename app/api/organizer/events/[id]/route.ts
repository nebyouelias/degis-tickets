import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMyOrganizer, getOwnedEvent } from "@/lib/organizer";
import { logAction } from "@/lib/admin";
import type { EventCategory, TierKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "CONCERT", "FOOTBALL", "FESTIVAL", "NIGHTLIFE", "COMEDY",
  "CONFERENCE", "CULTURAL", "CHURCH", "OTHER",
] as const;

const TIER_KINDS = [
  "GA", "VIP", "VVIP", "EARLY_BIRD", "STUDENT", "TABLE",
] as const;

type TierInput = {
  id?: string; // existing tier, or undefined for a new one
  name?: string;
  kind?: string;
  priceEtb?: number;
  capacity?: number;
};

/**
 * Edit an event.
 *
 * Guardrails that matter:
 *  - capacity can never drop below tickets already sold
 *  - a tier with sales cannot be deleted, only closed by setting capacity = sold
 *  - price changes never affect existing orders (OrderItem snapshots unitPriceEtb)
 *  - changing date, title or venue on a LIVE event re-flags it for admin review
 *    while leaving it on sale, so buyers aren't stranded mid-purchase
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, organizer } = await getMyOrganizer();
  if (!user || !organizer) {
    return NextResponse.json({ error: "Organizer only." }, { status: 403 });
  }
  if (organizer.status === "REJECTED" || organizer.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Your organizer account is not active." },
      { status: 403 }
    );
  }

  const event = await getOwnedEvent(params.id, organizer.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
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

  const startsAt = new Date(body.startsAt ?? "");
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Add a valid date and time." }, { status: 400 });
  }

  const venueName = (body.venueName ?? "").trim();
  if (venueName.length < 2) {
    return NextResponse.json({ error: "Add a venue name." }, { status: 400 });
  }

  const category = CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])
    ? (body.category as EventCategory)
    : event.category;

  // ---- validate tier changes against what's already sold ----
  const existing = new Map(event.tiers.map((t) => [t.id, t]));
  const incoming = (body.tiers ?? []).filter((t) => (t.name ?? "").trim());
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "Keep at least one ticket type." },
      { status: 400 }
    );
  }

  const keptIds = new Set(
    incoming.map((t) => t.id).filter((id): id is string => Boolean(id))
  );

  for (const tier of event.tiers) {
    if (!keptIds.has(tier.id) && tier.sold > 0) {
      return NextResponse.json(
        {
          error: `"${tier.name}" has ${tier.sold} sold and can't be removed. Set its quantity to ${tier.sold} to close it instead.`,
        },
        { status: 400 }
      );
    }
  }

  for (const t of incoming) {
    if (!t.id) continue;
    const current = existing.get(t.id);
    if (!current) {
      return NextResponse.json({ error: "Unknown ticket type." }, { status: 400 });
    }
    const capacity = Math.round(Number(t.capacity));
    if (!Number.isFinite(capacity) || capacity < current.sold) {
      return NextResponse.json(
        {
          error: `"${current.name}" already has ${current.sold} sold — quantity can't go below that.`,
        },
        { status: 400 }
      );
    }
  }

  // ---- venue (reuse an existing record where possible) ----
  const city = (body.venueCity ?? event.venue.city).trim() || "Addis Ababa";
  let venueId = event.venueId;
  if (venueName !== event.venue.name || city !== event.venue.city) {
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
    venueId = venue.id;
  } else if ((body.venueAddress ?? "").trim() !== (event.venue.address ?? "")) {
    await db.venue.update({
      where: { id: event.venueId },
      data: { address: (body.venueAddress ?? "").trim() || null },
    });
  }

  // ---- material change detection ----
  const dateMoved = startsAt.getTime() !== event.startsAt.getTime();
  const venueMoved = venueId !== event.venueId;
  const titleChanged = title !== event.title;
  const material = dateMoved || venueMoved || titleChanged;

  const wasLive = event.published && event.reviewStatus === "APPROVED";
  const wantsPublished = body.published !== false;

  let reviewStatus = event.reviewStatus;
  let published = event.published;

  if (!wantsPublished) {
    published = false;
    reviewStatus = event.reviewStatus === "APPROVED" ? "APPROVED" : "DRAFT";
  } else if (organizer.status !== "APPROVED") {
    published = false;
    reviewStatus = "PENDING_REVIEW";
  } else if (event.reviewStatus !== "APPROVED") {
    published = false;
    reviewStatus = "PENDING_REVIEW";
  } else {
    // Live and approved: stay on sale, but flag material edits for admin
    published = true;
    reviewStatus = material ? "PENDING_REVIEW" : "APPROVED";
  }

  await db.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: event.id },
      data: {
        title: title.slice(0, 140),
        titleAm: (body.titleAm ?? "").trim().slice(0, 140) || null,
        description: (body.description ?? "").trim().slice(0, 4000),
        category,
        startsAt,
        coverImage: (body.coverImage ?? "").trim() || event.coverImage,
        venueId,
        published,
        reviewStatus,
      },
    });

    // remove tiers the organizer dropped (already proven to have zero sales)
    for (const tier of event.tiers) {
      if (!keptIds.has(tier.id)) {
        await tx.ticketTier.delete({ where: { id: tier.id } });
      }
    }

    for (const [i, t] of incoming.entries()) {
      const kind = (TIER_KINDS.includes(t.kind as (typeof TIER_KINDS)[number])
        ? t.kind
        : "GA") as TierKind;
      const price = Math.max(0, Math.round(Number(t.priceEtb)) || 0);
      const capacity = Math.max(1, Math.round(Number(t.capacity)) || 1);
      const name = (t.name ?? "").trim().slice(0, 60);

      if (t.id && existing.has(t.id)) {
        await tx.ticketTier.update({
          where: { id: t.id },
          data: { name, kind, priceEtb: price, capacity, sortOrder: i },
        });
      } else {
        await tx.ticketTier.create({
          data: {
            eventId: event.id,
            name,
            kind,
            priceEtb: price,
            capacity,
            sortOrder: i,
          },
        });
      }
    }
  });

  await logAction({
    actorId: user.id,
    actorLabel: user.phone ?? user.email ?? "organizer",
    action: material && wasLive ? "EVENT_MATERIALLY_EDITED" : "EVENT_EDITED",
    targetType: "Event",
    targetId: event.id,
    note: material
      ? [
          titleChanged && "title",
          dateMoved && "date",
          venueMoved && "venue",
        ]
          .filter(Boolean)
          .join(", ") + " changed"
      : title,
  });

  return NextResponse.json({
    ok: true,
    published,
    reviewStatus,
    flaggedForReview: material && wasLive,
  });
}

/** Delete an event — only while nothing has been sold. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { user, organizer } = await getMyOrganizer();
  if (!user || !organizer) {
    return NextResponse.json({ error: "Organizer only." }, { status: 403 });
  }

  const event = await getOwnedEvent(params.id, organizer.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const ticketCount = await db.ticket.count({ where: { eventId: event.id } });
  if (ticketCount > 0) {
    return NextResponse.json(
      {
        error:
          "Tickets have been issued for this event, so it can't be deleted. Unpublish it instead, or contact Degis support to cancel and refund.",
      },
      { status: 400 }
    );
  }

  await db.event.delete({ where: { id: event.id } });

  await logAction({
    actorId: user.id,
    actorLabel: user.phone ?? user.email ?? "organizer",
    action: "EVENT_DELETED",
    targetType: "Event",
    targetId: event.id,
    note: event.title,
  });

  return NextResponse.json({ ok: true });
}
