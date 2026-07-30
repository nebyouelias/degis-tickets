import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { chapaVerify } from "@/lib/chapa";
import { markOrderPaid } from "@/lib/inventory";
import { issueTicketsForOrder } from "@/lib/issue-tickets";

export const dynamic = "force-dynamic";

/**
 * Chapa payment webhook.
 * Defense in depth: we check the HMAC signature if a webhook secret is set,
 * and regardless we ALWAYS confirm with Chapa's verify API before marking paid.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (secret) {
    const signature =
      request.headers.get("chapa-signature") ??
      request.headers.get("x-chapa-signature") ??
      "";
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  }

  let payload: { tx_ref?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  if (!payload.tx_ref) return NextResponse.json({ ok: true });

  const order = await db.order.findUnique({
    where: { chapaTxRef: payload.tx_ref },
  });
  if (!order) return NextResponse.json({ ok: true });

  if (order.status === "PENDING") {
    const verification = await chapaVerify(payload.tx_ref);
    if (verification.paid && verification.amountEtb >= order.totalEtb) {
      await markOrderPaid(order.id);
      await issueTicketsForOrder(order.id);
      // Phase 5: send ticket links by SMS / Telegram here
    }
  } else if (order.status === "PAID") {
    await issueTicketsForOrder(order.id); // safety net, idempotent
  }

  return NextResponse.json({ ok: true });
}
