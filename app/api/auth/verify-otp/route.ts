import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashOtp } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  let body: { phone?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  const code = (body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code we sent you." },
      { status: 400 }
    );
  }

  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json(
      { error: "Code expired. Request a new one." },
      { status: 400 }
    );
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 }
    );
  }

  if (otp.codeHash !== hashOtp(phone, code)) {
    await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json(
      { error: "That code isn't right. Check and try again." },
      { status: 400 }
    );
  }

  await db.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
