import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, logAction } from "@/lib/admin";
import { sendSms } from "@/lib/sms";
import type { EventReviewStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  let body: { eventId?: string; action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const event = body.eventId
    ? await db.event.findUnique({
        where: { id: body.eventId },
        include: { organizer: true },
      })
    : null;
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  let reviewStatus: EventReviewStatus;
  let published: boolean;

  switch (body.action) {
    case "approve":
      reviewStatus = "APPROVED";
      published = true;
      break;
    case "reject":
      reviewStatus = "REJECTED";
      published = false;
      break;
    case "unpublish":
      reviewStatus = event.reviewStatus;
      published = false;
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  await db.event.update({
    where: { id: event.id },
    data: {
      reviewStatus,
      published,
      reviewNote: body.note?.slice(0, 500) ?? null,
      reviewedAt: new Date(),
    },
  });

  await logAction({
    actorId: admin.id,
    actorLabel: admin.phone ?? admin.email ?? "admin",
    action: `EVENT_${body.action.toUpperCase()}`,
    targetType: "Event",
    targetId: event.id,
    note: body.note ?? event.title,
  });

  if (event.organizer.phone && body.action !== "unpublish") {
    void sendSms(
      event.organizer.phone,
      body.action === "approve"
        ? `Degis: "${event.title}" is approved and now on sale.`
        : `Degis: "${event.title}" was not approved.${body.note ? " " + body.note.slice(0, 120) : ""}`
    );
  }

  return NextResponse.json({ ok: true, reviewStatus, published });
}
