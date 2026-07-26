import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";
import { formatEtb, formatEventDate } from "@/lib/format";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  PAID: "border-gold/40 bg-gold-faint text-gold",
  PENDING: "border-ink-500 bg-ink-800 text-ink-300",
  EXPIRED: "border-crimson/40 bg-crimson-muted/40 text-ink-300",
  CANCELLED: "border-crimson/40 bg-crimson-muted/40 text-ink-300",
  REFUNDED: "border-ink-500 bg-ink-800 text-ink-300",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const [orders, ticketCount] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      include: { event: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.ticket.count({ where: { order: { userId: user.id } } }),
  ]);

  const identifier = user.phone ? maskPhone(user.phone) : user.email ?? "";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Your account
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">
        {user.name ?? "Welcome to Degis"}
      </h1>
      <p className="mt-1 text-ink-300">{identifier}</p>

      <Link
        href="/tickets"
        className="mt-6 flex items-center justify-between rounded-card border border-gold/25 bg-gold-faint/40 p-5 transition-colors hover:border-gold/50"
      >
        <div>
          <p className="font-semibold">Ticket wallet</p>
          <p className="mt-0.5 text-sm text-ink-300">
            {ticketCount === 0
              ? "No tickets yet"
              : `${ticketCount} ticket${ticketCount === 1 ? "" : "s"} ready to scan`}
          </p>
        </div>
        <span className="font-ethiopic text-xl text-gold">ድ</span>
      </Link>

      <h2 className="mt-10 text-lg font-bold">Your orders</h2>
      {orders.length === 0 ? (
        <div className="mt-4 rounded-card border border-ink-700 bg-ink-900 p-8 text-center shadow-card">
          <p className="font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-ink-300">
            Find your next celebration on the events page.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-crimson px-5 py-2 text-sm font-semibold transition-colors hover:bg-crimson-hover"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-ink-500"
              >
                <div>
                  <p className="font-semibold">{order.event.title}</p>
                  <p className="mt-0.5 text-sm text-ink-300">
                    {formatEventDate(order.event.startsAt)} ·{" "}
                    {formatEtb(order.totalEtb)} ETB
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge[order.status]}`}
                >
                  {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <SignOutButton />
      </div>
    </div>
  );
}
