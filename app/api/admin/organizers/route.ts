import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, logAction } from "@/lib/admin";
import { sendSms } from "@/lib/sms";
import type { OrganizerStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, OrganizerStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  suspend: "SUSPENDED",
  reinstate: "APPROVED",
};

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  let body: {
    organizerId?: string;
    action?: string;
    note?: string;
    verified?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = ACTIONS[body.action ?? ""];
  if (!body.organizerId || !status) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const organizer = await db.organizer.update({
    where: { id: body.organizerId },
    data: {
      status,
      verified: status === "APPROVED" ? (body.verified ?? true) : false,
      reviewedAt: new Date(),
      reviewedById: admin.id,
      reviewNote: body.note?.slice(0, 500) ?? null,
    },
  });

  // Suspension pulls their events off sale immediately
  if (status === "SUSPENDED" || status === "REJECTED") {
    await db.event.updateMany({
      where: { organizerId: organizer.id },
      data: { published: false },
    });
  }

  await logAction({
    actorId: admin.id,
    actorLabel: admin.phone ?? admin.email ?? "admin",
    action: `ORGANIZER_${status}`,
    targetType: "Organizer",
    targetId: organizer.id,
    note: body.note ?? null,
  });

  if (organizer.phone) {
    const message =
      status === "APPROVED"
        ? `Degis: your organizer account "${organizer.name}" is approved. You can publish events and start selling now.`
        : status === "REJECTED"
          ? `Degis: we could not approve "${organizer.name}" yet.${body.note ? " " + body.note.slice(0, 100) : " Please contact support."}`
          : `Degis: your organizer account "${organizer.name}" has been suspended. Contact support.`;
    void sendSms(organizer.phone, message);
  }

  return NextResponse.json({ ok: true, status });
}
