import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;

export async function POST(request: Request) {
  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number, e.g. 09XX XXX XXX." },
      { status: 400 }
    );
  }

  // Rate limit: max 3 codes per phone per 10 minutes
  const windowStart = new Date(Date.now() - OTP_TTL_MS);
  const recent = await db.otpCode.count({
    where: { phone, createdAt: { gte: windowStart } },
  });
  if (recent >= MAX_CODES_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many codes requested. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const code = generateOtp();
  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  try {
    const result = await sendOtpSms(phone, code);
    return NextResponse.json({
      sent: true,
      phone,
      // Dev mode only: surface the code so the flow is testable without SMS.
      ...(result.devMode ? { devCode: code, devMode: true } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not send the code. Try again shortly." },
      { status: 500 }
    );
  }
}
