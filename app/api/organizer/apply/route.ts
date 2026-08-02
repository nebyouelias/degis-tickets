import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/organizer";
import { logAction } from "@/lib/admin";
import type { BusinessType } from "@prisma/client";

export const dynamic = "force-dynamic";

const BUSINESS_TYPES = [
  "SOLE_PROPRIETOR",
  "PLC",
  "SHARE_COMPANY",
  "NGO",
  "ASSOCIATION",
  "CHURCH",
  "GOVERNMENT",
  "OTHER",
] as const;

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) || null : null;

/** Organizer application. Creates a PENDING organizer awaiting admin review. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const existing = await db.organizer.findFirst({ where: { ownerId: user.id } });
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, existing: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = str(body.name, 80);
  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Enter your organizer or venue name." },
      { status: 400 }
    );
  }

  const contactPhone = normalizePhone(String(body.phone ?? "")) ?? user.phone;
  if (!contactPhone) {
    return NextResponse.json(
      { error: "Add a contact phone number." },
      { status: 400 }
    );
  }

  if (!str(body.legalName, 120)) {
    return NextResponse.json(
      { error: "Enter the registered legal name of the business." },
      { status: 400 }
    );
  }
  if (!str(body.licenseUrl, 500)) {
    return NextResponse.json(
      { error: "Upload your trade licence." },
      { status: 400 }
    );
  }
  if (!str(body.bankAccountNumber, 60) || !str(body.bankName, 80)) {
    return NextResponse.json(
      { error: "Add the bank account we should pay you into." },
      { status: 400 }
    );
  }

  const businessType = BUSINESS_TYPES.includes(
    body.businessType as (typeof BUSINESS_TYPES)[number]
  )
    ? (body.businessType as BusinessType)
    : "SOLE_PROPRIETOR";

  const organizer = await db.organizer.create({
    data: {
      name,
      slug: slugify(name),
      status: "PENDING",
      legalName: str(body.legalName, 120),
      businessType,
      tin: str(body.tin, 40),
      licenseNumber: str(body.licenseNumber, 60),
      licenseUrl: str(body.licenseUrl, 500),
      idDocUrl: str(body.idDocUrl, 500),
      city: str(body.city, 60) ?? "Addis Ababa",
      address: str(body.address, 200),
      website: str(body.website, 200),
      telegram: str(body.telegram, 100),
      description: str(body.description, 1000),
      phone: contactPhone,
      email: str(body.email, 120) ?? user.email,
      contactName: str(body.contactName, 80) ?? user.name,
      bankName: str(body.bankName, 80),
      bankAccountName: str(body.bankAccountName, 120),
      bankAccountNumber: str(body.bankAccountNumber, 60),
      ownerId: user.id,
    },
  });

  if (user.role === "ATTENDEE") {
    await db.user.update({
      where: { id: user.id },
      data: { role: "ORGANIZER" },
    });
  }

  await logAction({
    actorId: user.id,
    actorLabel: user.phone ?? user.email ?? "user",
    action: "ORGANIZER_APPLIED",
    targetType: "Organizer",
    targetId: organizer.id,
    note: name,
  });

  return NextResponse.json({ ok: true, id: organizer.id });
}
