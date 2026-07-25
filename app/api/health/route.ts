import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Safe diagnostics: reports presence/values of config, never secrets.
export async function GET() {
  return NextResponse.json({
    otpDevMode: process.env.OTP_DEV_MODE ?? "(not set)",
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasGoogleClient: Boolean(process.env.GOOGLE_CLIENT_ID),
    deployedAt: new Date().toISOString(),
  });
}
