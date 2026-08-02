import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/organizer";
import { OrganizerNav } from "@/components/organizer/OrganizerNav";
import { formatEtb } from "@/lib/format";
import { maskForGate } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

const badge: Record<string, string> = {
  PAID: "border-emerald-600/40 bg-emerald-950/40 text-emerald-400",
  PENDING: "border-gold/40 bg-gold-faint text-gold",
  EXPIRED: "border-ink-700 bg-ink-800 text-ink-500",
  CANCELLED: "border-ink-700 bg-ink-800 text-ink-500",
  REFUNDED: "border-crimson/40 bg-crimson-muted/40 text-crimson-hover",
};

export default async function OrganizerOrders({
  searchParams,
}: {
  searchParams: { event?: string; status?: string };
}) {
  const { organizer } = await requireOrganizer();

  const [events, orders] = await Promise.all([
    db.event.findMany({
      where: { organizerId: organizer.id },
      select: { id: true, title: true },
      orderBy: { startsAt: "desc" },
    }),
    db.order.findMany({
      where: {
        event: { organizerId: organizer.id },
        ...(searchParams.event ? { eventId: searchParams.event } : {}),
        ...(searchParams.status
          ? { status: searchParams.status as "PAID" }
          : {}),
      },
      include: {
        event: { select: { title: true } },
        items: { include: { tier: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const paid = orders.filter((o) => o.status === "PAID");
  const revenue = paid.reduce((s, o) => s + o.subtotalEtb, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        {organizer.name}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Orders</h1>
      <div className="mt-5">
        <OrganizerNav active="/organizer/orders" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/organizer/orders"
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
            !searchParams.event && !searchParams.status
              ? "border-ink-500 text-ink-100"
              : "border-ink-700 text-ink-300"
          }`}
        >
          All
        </Link>
        <Link
          href="/organizer/orders?status=PAID"
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
            searchParams.status === "PAID"
              ? "border-ink-500 text-ink-100"
              : "border-ink-700 text-ink-300"
          }`}
        >
          Paid only
        </Link>
        {events.slice(0, 6).map((e) => (
          <Link
            key={e.id}
            href={`/organizer/orders?event=${e.id}`}
            className={`max-w-[200px] truncate rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              searchParams.event === e.id
                ? "border-ink-500 text-ink-100"
                : "border-ink-700 text-ink-300"
            }`}
          >
            {e.title}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-gold/25 bg-gold-faint/40 p-4">
          <p className="text-xs uppercase tracking-luxe text-ink-500">
            Revenue shown
          </p>
          <p className="mt-1 text-lg font-bold text-gold">
            {formatEtb(revenue)} ETB
          </p>
        </div>
        <div className="rounded-card border border-ink-700 bg-ink-900 p-4">
          <p className="text-xs uppercase tracking-luxe text-ink-500">
            Paid orders
          </p>
          <p className="mt-1 text-lg font-bold">{paid.length}</p>
        </div>
        <div className="rounded-card border border-ink-700 bg-ink-900 p-4">
          <p className="text-xs uppercase tracking-luxe text-ink-500">Tickets</p>
          <p className="mt-1 text-lg font-bold">
            {paid.reduce((s, o) => s + o._count.tickets, 0)}
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-ink-700 bg-ink-900">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-luxe text-ink-500">
              <tr className="border-b border-ink-700">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {order.id.slice(-8).toUpperCase()}
                    <span className="block text-ink-500">
                      {order.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-ink-300">
                    {order.event.title}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {maskForGate(order.deliveryPhone)}
                    {order.channel === "BOX_OFFICE" && (
                      <span className="ml-1.5 rounded-full border border-gold/30 bg-gold-faint px-1.5 py-0.5 text-[9px] font-bold text-gold">
                        CASH
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-300">
                    {order.items
                      .map((i) => `${i.quantity}× ${i.tier.name}`)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatEtb(order.subtotalEtb)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-500">
        Amounts shown are your earnings — the Degis service fee is charged to the
        buyer on top and is not included here.
      </p>
    </div>
  );
}
