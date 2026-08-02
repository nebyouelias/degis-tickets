import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { ActionButton } from "@/components/admin/ActionButtons";
import { normalizePhone } from "@/lib/phone";
import { formatEtb, formatEventDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const orderBadge: Record<string, string> = {
  PAID: "border-emerald-600/40 bg-emerald-950/40 text-emerald-400",
  PENDING: "border-gold/40 bg-gold-faint text-gold",
  EXPIRED: "border-ink-700 bg-ink-800 text-ink-300",
  CANCELLED: "border-ink-700 bg-ink-800 text-ink-300",
  REFUNDED: "border-crimson/40 bg-crimson-muted/40 text-crimson-hover",
};

/**
 * Support lookup.
 *
 * One box, four kinds of input: phone number, ticket code, order id, or a name.
 * "I paid and got nothing" is answerable in one search — and every fix is a
 * button on the result.
 */
export default async function AdminLookup({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireAdmin();
  const q = searchParams.q?.trim() ?? "";

  const phone = normalizePhone(q);
  const looksLikeTicket = /^DGS-?[A-Z0-9]{4,}$/i.test(q);

  const orders = q
    ? await db.order.findMany({
        where: {
          OR: [
            ...(phone ? [{ deliveryPhone: phone }] : []),
            ...(phone ? [{ user: { is: { phone } } }] : []),
            { id: q },
            { chapaTxRef: q },
            ...(q.length >= 6 ? [{ id: { endsWith: q.toLowerCase() } }] : []),
            ...(looksLikeTicket
              ? [{ tickets: { some: { code: q.toUpperCase() } } }]
              : []),
            ...(q.length >= 3
              ? [{ user: { is: { name: { contains: q, mode: "insensitive" as const } } } }]
              : []),
          ],
        },
        include: {
          event: { include: { venue: true, organizer: true } },
          user: true,
          items: { include: { tier: true } },
          tickets: { include: { tier: true }, orderBy: { seq: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Degis admin
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Customer lookup</h1>
      <div className="mt-5">
        <AdminNav active="/admin/lookup" />
      </div>

      <form
        action="/admin/lookup"
        className="mt-6 flex items-center rounded-full border border-ink-700 bg-ink-900 p-1.5 pl-5"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Phone, ticket code (DGS-XXXXXX), order id, or name…"
          className="w-full bg-transparent text-sm outline-none placeholder-ink-500"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-crimson px-6 py-2.5 text-sm font-semibold"
        >
          Search
        </button>
      </form>

      {!q && (
        <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 text-sm text-ink-300">
          <p className="font-semibold text-ink-100">Common situations</p>
          <ul className="mt-3 space-y-2">
            <li>
              <strong className="text-ink-100">&quot;I paid but got nothing&quot;</strong> —
              search their phone. If the order is PENDING, use{" "}
              <em>Re-check payment</em>: it asks Chapa directly and settles the
              order if the money arrived.
            </li>
            <li>
              <strong className="text-ink-100">&quot;I never got the SMS&quot;</strong> —
              find the order and use <em>Resend ticket SMS</em>.
            </li>
            <li>
              <strong className="text-ink-100">&quot;My ticket says already used&quot;</strong>{" "}
              — search the ticket code and check the status; you can restore a
              ticket that was checked in by mistake.
            </li>
            <li>
              <strong className="text-ink-100">Refund request</strong> — refunding
              voids the tickets and returns the seats to sale. Move the money in
              Chapa separately.
            </li>
          </ul>
        </div>
      )}

      {q && orders.length === 0 && (
        <p className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 text-sm text-ink-300">
          Nothing found for “{q}”. Try the full phone number, the exact ticket
          code, or the order id.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-card border border-ink-700 bg-ink-900 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {order.event.title}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${orderBadge[order.status]}`}
                  >
                    {order.status}
                  </span>
                  {order.channel === "BOX_OFFICE" && (
                    <span className="rounded-full border border-gold/30 bg-gold-faint px-2 py-0.5 text-[10px] font-bold text-gold">
                      CASH
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-ink-300">
                  {formatEventDateTime(order.event.startsAt)} ·{" "}
                  {order.event.venue.name} · {order.event.organizer.name}
                </p>
              </div>
              <p className="text-right font-bold">
                {formatEtb(order.totalEtb)} ETB
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-700 pt-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-luxe text-ink-500">
                  Order
                </dt>
                <dd className="mt-0.5 font-mono">
                  {order.id.slice(-8).toUpperCase()}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-luxe text-ink-500">
                  Buyer
                </dt>
                <dd className="mt-0.5 font-mono">
                  {order.deliveryPhone || order.user.phone || order.user.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-luxe text-ink-500">
                  Placed
                </dt>
                <dd className="mt-0.5">
                  {order.createdAt.toLocaleString("en-GB", {
                    timeZone: "Africa/Addis_Ababa",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-luxe text-ink-500">
                  SMS sent
                </dt>
                <dd className="mt-0.5 text-xs">
                  paid: {order.paidSmsAt ? "yes" : "no"} · entry:{" "}
                  {order.entrySmsAt ? "yes" : "no"}
                </dd>
              </div>
            </dl>

            {/* Tickets */}
            <div className="mt-4">
              <p className="text-xs uppercase tracking-luxe text-ink-500">
                Tickets ({order.tickets.length})
              </p>
              {order.tickets.length === 0 ? (
                <p className="mt-2 text-sm text-crimson-hover">
                  No tickets issued
                  {order.status === "PAID" && " — this order is paid, use Reissue"}
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {order.tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-800 p-3 text-sm"
                    >
                      <div>
                        <span className="font-mono font-bold">{ticket.code}</span>
                        <span className="ml-2 text-ink-300">
                          {ticket.tier.name} · {ticket.status}
                          {ticket.checkedInAt &&
                            ` at ${ticket.checkedInAt.toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Africa/Addis_Ababa",
                            })}`}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {ticket.status !== "VOID" ? (
                          <ActionButton
                            endpoint="actions"
                            payload={{ action: "void_ticket", id: ticket.id }}
                            label="Void"
                            tone="danger"
                            confirm={`Void ${ticket.code}?`}
                          />
                        ) : (
                          <ActionButton
                            endpoint="actions"
                            payload={{ action: "restore_ticket", id: ticket.id }}
                            label="Restore"
                          />
                        )}
                        {ticket.status === "CHECKED_IN" && (
                          <ActionButton
                            endpoint="actions"
                            payload={{ action: "restore_ticket", id: ticket.id }}
                            label="Undo check-in"
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Support actions */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-700 pt-4">
              {order.status === "PENDING" && (
                <ActionButton
                  endpoint="actions"
                  payload={{ action: "recheck_payment", id: order.id }}
                  label="Re-check payment with Chapa"
                  tone="primary"
                />
              )}
              {order.status === "PAID" && (
                <>
                  <ActionButton
                    endpoint="actions"
                    payload={{ action: "resend_ticket_sms", id: order.id }}
                    label="Resend ticket SMS"
                  />
                  <ActionButton
                    endpoint="actions"
                    payload={{ action: "reissue_tickets", id: order.id }}
                    label="Reissue tickets"
                  />
                  <ActionButton
                    endpoint="actions"
                    payload={{ action: "refund_order", id: order.id }}
                    label="Refund & release seats"
                    tone="danger"
                    confirm="Refund this order? Tickets are voided and the seats go back on sale. Move the money in Chapa separately."
                  />
                </>
              )}
              <Link
                href={`/admin/organizers/${order.event.organizerId}`}
                className="rounded-full border border-ink-700 px-4 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:text-ink-100"
              >
                View organizer
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
