import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function getMyOrganizer() {
  const user = await getCurrentUser();
  if (!user) return { user: null, organizer: null };

  const organizer = await db.organizer.findFirst({
    where: { ownerId: user.id },
  });
  return { user, organizer };
}

/** Organizer routes: must be signed in and have applied. */
export async function requireOrganizer() {
  const { user, organizer } = await getMyOrganizer();
  if (!user) redirect("/signin?next=/organizer");
  if (!organizer) redirect("/organizer/apply");
  return { user, organizer };
}

/**
 * Selling requires approval; building does not.
 * An applicant can create and edit events while under review — they stay engaged,
 * and they're ready to publish the moment we approve them.
 */
export function canSell(status: string): boolean {
  return status === "APPROVED";
}

/** Load an event only if it belongs to this organizer. */
export async function getOwnedEvent(eventId: string, organizerId: string) {
  return db.event.findFirst({
    where: { id: eventId, organizerId },
    include: {
      venue: true,
      tiers: { orderBy: [{ sortOrder: "asc" }, { priceEtb: "asc" }] },
    },
  });
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `event-${suffix}`;
}
