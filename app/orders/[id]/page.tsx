import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { chapaVerify } from "@/lib/chapa";
import { markOrderPaid } from "@/lib/inventory";
import { formatEtb, formatEventDateTime } from "@/lib/format";
import { maskPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  let order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      event: { include: { venue: true } },
      items: { include: { tier: true } },
    },
  });
  if (!order || order.userId !== user.id) notFound();

  // Backup verification path: if still pending, ask Chapa directly.
  // (The webhook usually gets here first — this covers the gap.)
  if (order.status === "PENDING") {
    try {
      const v = await chapaVerify(order.chapaTxRef);
      if (v.paid && v.amountEtb >= order.totalEtb) {
        await markOrderPaid(order.id);
        order = { ...order, status: "PAID", paidAt: new Date() };
      }
    } catch {
      // verification unavailable — show pending state
    }
  }

  const statusView = {
    PAID: {
      badge: "Paid",
      badgeClass: "border-gold/40 bg-gold-faint text-gold",
      title: "You're going! 🎉",
      body: "Payment confirmed. Your QR tickets arrive here and by SMS in Phase 4 — for now this order is your proof of purchase.",
    },
    PENDING: {
      badge: "Awaiting payment",
      badgeClass: "border-ink-500 bg-ink-800 text-ink-300",
      title: "Waiting for your payment…",
      body: "If you completed payment, refresh this page in a moment. Unpaid orders release their tickets after 15 minutes.",
    },
    EXPIRED: {
      badge: "Expired",
      badgeClass: "border-crimson/40 bg-crimson-muted/40 text-ink-100",
      title: "This order expired",
      body: "The 15-minute payment window passed and the tickets were released. Start a new order from the event page.",
    },
    CANCELLED: {
      badge: "Cancelled",
      badgeClass: "border-crimson/40 bg-crimson-muted/40 text-ink-100",
      title: "Order cancelled",
      body: "",
    },
    REFUNDED: {
      badge: "Refunded",
      badgeClass: "border-ink-500 bg-ink-800 text-ink-300",
      title: "Order refunded",
      body: "",
    },
  }[order.status];

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <span
        className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${statusView.badgeClass}`}
      >
        {statusView.badge}
      </span>
      <h1 className="mt-3 text-3xl font-extrabold">{statusView.title}</h1>
      <p className="mt-2 text-ink-300">{statusView.body}</p>

      <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-luxe text-ink-500">
          Event
        </p>
        <p className="mt-1 text-lg font-bold">{order.event.title}</p>
        <p className="text-sm text-ink-300">
          {formatEventDateTime(order.event.startsAt)} · {order.event.venue.name}
        </p>

        <div className="mt-5 space-y-2 border-t border-ink-700 pt-4 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-ink-300">
              <span>
                {item.quantity} × {item.tier.name}
              </span>
              <span>{formatEtb(item.unitPriceEtb * item.quantity)} ETB</span>
            </div>
          ))}
          <div className="flex justify-between text-ink-300">
            <span>Service fee</span>
            <span>{formatEtb(order.serviceFeeEtb)} ETB</span>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-2 text-base font-bold text-ink-100">
            <span>Total</span>
            <span>{formatEtb(order.totalEtb)} ETB</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-500">
          Order {order.id.slice(-8).toUpperCase()} · Delivery to{" "}
          {maskPhone(order.deliveryPhone)}
        </p>
      </div>

      <div className="mt-8 flex gap-4">
        {order.status === "PENDING" && (
          <Link
            href={`/orders/${order.id}`}
            className="rounded-full bg-crimson px-5 py-2 text-sm font-semibold transition-colors hover:bg-crimson-hover"
          >
            Check again
          </Link>
        )}
        <Link
          href="/account"
          className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-300 transition-colors hover:text-ink-100"
        >
          My account
        </Link>
      </div>
    </div>
  );
}
