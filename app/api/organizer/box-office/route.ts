import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMyOrganizer, getOwnedEvent } from "@/lib/organizer";
import { normalizePhone } from "@/lib/phone";
import { boxOfficeFee } from "@/lib/fees";
import { reserveTiers, SoldOutError } from "@/lib/inventory";
import { issueTicketsForOrder } from "@/lib/issue-tickets";
import { notifyBoxOfficeSale } from "@/lib/notify";

export const dynamic = "force-dynamic";

const MAX_PER_SALE = 20;

/**
 * Box office sale: cash or direct transfer taken at the door or ticket office.
 * Creates an already-PAID order and issues real QR tickets immediately.
 *
 * If a customer phone is given we attach the order to that phone's account —
 * so when they later sign in with that number, the ticket is already in their
 * wallet. Meets the market where it is instead of fighting cash.
 */
export async function POST(request: Request) {
  const { user, organizer } = await getMyOrganizer();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!organizer) {
    return NextResponse.json({ error: "Organizer only." }, { status: 403 });
  }

  let body: {
    eventId?: string;
    items?: Array<{ tierId: string; quantity: number }>;
    customerPhone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "Missing event." }, { status: 400 });
  }

  // Ownership check — the event must belong to this organizer
  const event = await getOwnedEvent(body.eventId, organizer.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const items = (body.items ?? []).filter(
    (i) => Number.isInteger(i.quantity) && i.quantity > 0
  );
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  if (items.length === 0) {
    return NextResponse.json({ error: "Select at least one ticket." }, { status: 400 });
  }
  if (totalQty > MAX_PER_SALE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PER_SALE} tickets per sale.` },
      { status: 400 }
    );
  }

  const tierMap = new Map(event.tiers.map((t) => [t.id, t]));
  for (const item of items) {
    if (!tierMap.has(item.tierId)) {
      return NextResponse.json({ error: "Invalid ticket selection." }, { status: 400 });
    }
  }

  // Buyer: their own account if we have a phone, otherwise the organizer's
  const customerPhone = normalizePhone(body.customerPhone ?? "");
  let buyerId = user.id;
  if (customerPhone) {
    const buyer = await db.user.upsert({
      where: { phone: customerPhone },
      update: {},
      create: { phone: customerPhone },
    });
    buyerId = buyer.id;
  }

  const subtotal = items.reduce(
    (s, i) => s + tierMap.get(i.tierId)!.priceEtb * i.quantity,
    0
  );
  const fee = boxOfficeFee(totalQty);

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
          userId: buyerId,
          eventId: event.id,
          status: "PAID",
          channel: "BOX_OFFICE",
          subtotalEtb: subtotal,
          serviceFeeEtb: fee,
          totalEtb: subtotal, // cash collected at face value; our fee is settled separately
          deliveryPhone: customerPhone ?? organizer.phone ?? "",
          chapaTxRef: `boxoffice-${crypto.randomUUID()}`,
          paidAt: new Date(),
          expiresAt: new Date(),
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

    await issueTicketsForOrder(order.id);
    await notifyBoxOfficeSale(order.id); // no-op when no customer phone was given

    const tickets = await db.ticket.findMany({
      where: { orderId: order.id },
      include: { tier: true },
      orderBy: { seq: "asc" },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      collectedEtb: subtotal,
      tickets: tickets.map((t) => ({
        id: t.id,
        code: t.code,
        tierName: t.tier.name,
      })),
    });
  } catch (e) {
    if (e instanceof SoldOutError) {
      return NextResponse.json(
        { error: `${e.tierName} doesn't have enough tickets left.` },
        { status: 409 }
      );
    }
    console.error("Box office sale failed:", e);
    return NextResponse.json(
      { error: "Sale could not be recorded. Try again." },
      { status: 500 }
    );
  }
}
