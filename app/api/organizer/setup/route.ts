import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/organizer";

export const dynamic = "force-dynamic";

/** Self-serve organizer onboarding. Verification stays a manual admin step. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const existing = await db.organizer.findFirst({ where: { ownerId: user.id } });
  if (existing) return NextResponse.json({ ok: true, slug: existing.slug });

  let body: { name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Enter your organizer or venue name." },
      { status: 400 }
    );
  }

  const organizer = await db.organizer.create({
    data: {
      name,
      slug: slugify(name),
      phone: normalizePhone(body.phone ?? "") ?? user.phone,
      ownerId: user.id,
    },
  });

  // Promote the account, unless they're already an admin
  if (user.role === "ATTENDEE") {
    await db.user.update({
      where: { id: user.id },
      data: { role: "ORGANIZER" },
    });
  }

  return NextResponse.json({ ok: true, slug: organizer.slug });
}
