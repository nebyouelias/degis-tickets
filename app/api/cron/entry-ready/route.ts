import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyEntryReady } from "@/lib/notify";
import { ENTRY_OPENS_HOURS_BEFORE } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Texts buyers the moment their entry codes activate.
 *
 * Runs on a schedule (Vercel Cron, or any external cron hitting this URL with
 * the secret). Each order is claimed atomically inside notifyEntryReady, so
 * overlapping runs cannot double-send.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const queryKey = new URL(request.url).searchParams.get("key");

  // Vercel Cron sends the secret as a Bearer token; external crons can use ?key=
  if (secret && auth !== `Bearer ${secret}` && queryKey !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(
    now.getTime() + ENTRY_OPENS_HOURS_BEFORE * 60 * 60 * 1000
  );

  // Orders for events whose entry window has opened but not yet started,
  // and which haven't been texted yet.
  const orders = await db.order.findMany({
    where: {
      status: "PAID",
      entrySmsAt: null,
      deliveryPhone: { not: "" },
      event: { startsAt: { lte: windowStart, gte: now } },
    },
    select: { id: true },
    take: 200,
  });

  let sent = 0;
  for (const order of orders) {
    if (await notifyEntryReady(order.id)) sent++;
  }

  return NextResponse.json({
    checked: orders.length,
    sent,
    at: now.toISOString(),
  });
}
