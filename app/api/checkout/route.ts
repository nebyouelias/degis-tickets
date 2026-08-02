import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { serviceFee } from "@/lib/fees";
import { chapaInitialize } from "@/lib/chapa";
import {
  releaseExpiredOrders,
  reserveTiers,
  SoldOutError,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

const ORDER_TTL_MS = 15 * 60 * 1000;
const MAX_PER_ORDER = 10;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to buy tickets." }, { status: 401 });
  }

  let body: {
    eventId?: string;
    items?: Array<{ tierId: string; quantity: number }>;
    phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const items = (body.items ?? []).filter(
    (i) => Number.isInteger(i.quantity) && i.quantity > 0
  );
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  if (!body.eventId || items.length === 0) {
    return NextResponse.json({ error: "Select at least one ticket." }, { status: 400 });
  }
  if (totalQty > MAX_PER_ORDER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PER_ORDER} tickets per order.` },
      { status: 400 }
    );
  }

  const deliveryPhone = normalizePhone(body.phone ?? "") ?? user.phone;
  if (!deliveryPhone) {
    return NextResponse.json(
      { error: "Add a phone number — tickets are delivered by SMS." },
      { status: 400 }
    );
  }

  // Free up any stale holds on this event before checking availability
  await releaseExpiredOrders(body.eventId);

  const event = await db.event.findUnique({
    where: { id: body.eventId },
    include: { tiers: true, organizer: { select: { status: true } } },
  });
  // Only an approved organizer's approved, published event can take money
  if (
    !event ||
    !event.published ||
    event.reviewStatus !== "APPROVED" ||
    event.organizer.status !== "APPROVED" ||
    event.startsAt < new Date()
  ) {
    return NextResponse.json({ error: "This event isn't on sale." }, { status: 400 });
  }

  const tierMap = new Map(event.tiers.map((t) => [t.id, t]));
  for (const item of items) {
    if (!tierMap.has(item.tierId)) {
      return NextResponse.json({ error: "Invalid ticket selection." }, { status: 400 });
    }
  }

  const subtotal = items.reduce(
    (s, i) => s + tierMap.get(i.tierId)!.priceEtb * i.quantity,
    0
  );
  const fee = serviceFee(subtotal);
  const total = subtotal + fee;

  // Reserve inventory + create the pending order atomically
  let orderId: string;
  try {
    const order = await db.$transaction(async (tx) => {
      await reserveTiers(
        tx,
        items.map((i) => ({
          tierId: i.tierId,
          quantity: i.quantity,
          tierName: tierMap.get(i.tierId)!.name,
        }))
      );
      return tx.order.create({
        data: {
          userId: user.id,
          eventId: event.id,
          subtotalEtb: subtotal,
          serviceFeeEtb: fee,
          totalEtb: total,
          deliveryPhone,
          chapaTxRef: `degis-${crypto.randomUUID()}`,
          expiresAt: new Date(Date.now() + ORDER_TTL_MS),
          items: {
            create: items.map((i) => ({
              tierId: i.tierId,
              quantity: i.quantity,
              unitPriceEtb: tierMap.get(i.tierId)!.priceEtb,
            })),
          },
        },
      });
    });
    orderId = order.id;

    const origin = new URL(request.url).origin;
    const { checkoutUrl } = await chapaInitialize({
      amountEtb: total,
      txRef: order.chapaTxRef,
      returnUrl: `${origin}/orders/${order.id}`,
      phone: deliveryPhone,
      email: user.email ?? undefined,
      firstName: user.name?.split(" ")[0],
      title: event.title,
    });

    return NextResponse.json({ checkoutUrl, orderId: order.id });
  } catch (e) {
    if (e instanceof SoldOutError) {
      return NextResponse.json(
        { error: `${e.tierName} doesn't have enough tickets left.` },
        { status: 409 }
      );
    }
    console.error("Checkout failed:", e);
    return NextResponse.json(
      { error: "Checkout couldn't be started. Try again." },
      { status: 500 }
    );
  }
}
