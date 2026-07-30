import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostics. Reports whether config is present — never the values.
 * Vercel only applies env vars on the NEXT deployment, so if something here
 * reads false right after you added it, redeploy.
 */
export async function GET() {
  return NextResponse.json({
    otpDevMode: process.env.OTP_DEV_MODE ?? "(not set)",
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDatabaseUrlUnpooled: Boolean(process.env.DATABASE_URL_UNPOOLED),
    hasTicketSeed: Boolean(process.env.TICKET_SIGNING_SEED),
    hasChapaKey: Boolean(process.env.CHAPA_SECRET_KEY),
    hasChapaWebhookSecret: Boolean(process.env.CHAPA_WEBHOOK_SECRET),
    hasGoogleClient: Boolean(process.env.GOOGLE_CLIENT_ID),
    deployedAt: new Date().toISOString(),
  });
}
