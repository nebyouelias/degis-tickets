import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { ActionButton } from "@/components/admin/ActionButtons";
import { formatEtb, formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOrganizerDetail({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const organizer = await db.organizer.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, phone: true, email: true, createdAt: true } },
      events: {
        include: { venue: true, tiers: true, _count: { select: { tickets: true } } },
        orderBy: { startsAt: "desc" },
      },
    },
  });
  if (!organizer) notFound();

  const [orders, logs] = await Promise.all([
    db.order.findMany({
      where: { event: { organizerId: organizer.id }, status: "PAID" },
      select: { subtotalEtb: true, serviceFeeEtb: true },
    }),
    db.auditLog.findMany({
      where: { targetType: "Organizer", targetId: organizer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const gmv = orders.reduce((s, o) => s + o.subtotalEtb, 0);
  const fees = orders.reduce((s, o) => s + o.serviceFeeEtb, 0);

  const field = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-xs uppercase tracking-luxe text-ink-500">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link
        href="/admin/organizers"
        className="text-sm text-ink-300 transition-colors hover:text-ink-100"
      >
        ← Organizers
      </Link>

      <h1 className="mt-3 flex flex-wrap items-center gap-3 text-3xl font-extrabold">
        {organizer.name}
        <span className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs font-bold">
          {organizer.status}
        </span>
      </h1>

      {/* Decision bar */}
      <div className="mt-5 flex flex-wrap gap-2 rounded-card border border-ink-700 bg-ink-900 p-4">
        {organizer.status !== "APPROVED" && (
          <ActionButton
            endpoint="organizers"
            payload={{ organizerId: organizer.id, action: "approve" }}
            label="Approve"
            tone="primary"
            confirm={`Approve ${organizer.name}? They will be able to publish and sell.`}
          />
        )}
        {organizer.status === "PENDING" && (
          <ActionButton
            endpoint="organizers"
            payload={{ organizerId: organizer.id, action: "reject" }}
            label="Reject"
            tone="danger"
            withNote
            confirm="Reject this application?"
          />
        )}
        {organizer.status === "APPROVED" && (
          <ActionButton
            endpoint="organizers"
            payload={{ organizerId: organizer.id, action: "suspend" }}
            label="Suspend"
            tone="danger"
            withNote
            confirm="Suspend this organizer? All their events come off sale immediately."
          />
        )}
        {organizer.status === "SUSPENDED" && (
          <ActionButton
            endpoint="organizers"
            payload={{ organizerId: organizer.id, action: "reinstate" }}
            label="Reinstate"
            tone="primary"
          />
        )}
      </div>

      {organizer.reviewNote && (
        <p className="mt-3 rounded-xl border border-ink-700 bg-ink-800 p-3 text-sm text-ink-300">
          Review note: {organizer.reviewNote}
        </p>
      )}

      {/* Business */}
      <section className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Business details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {field("Legal name", organizer.legalName)}
          {field("Business type", organizer.businessType.replace(/_/g, " "))}
          {field("TIN", organizer.tin)}
          {field("Licence number", organizer.licenseNumber)}
          {field("City", organizer.city)}
          {field("Address", organizer.address)}
          {field("Contact person", organizer.contactName)}
          {field("Phone", organizer.phone ?? organizer.owner?.phone)}
          {field("Email", organizer.email ?? organizer.owner?.email)}
          {field("Telegram", organizer.telegram)}
          {field("Website", organizer.website)}
          {field("Account owner", organizer.owner?.phone ?? organizer.owner?.email)}
        </dl>
        {organizer.description && (
          <p className="mt-4 border-t border-ink-700 pt-4 text-sm text-ink-300">
            {organizer.description}
          </p>
        )}
      </section>

      {/* Documents */}
      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Documents</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {organizer.licenseUrl ? (
            <a
              href={organizer.licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-gold/40 bg-gold-faint px-4 py-2 text-sm font-semibold text-gold"
            >
              View trade licence ↗
            </a>
          ) : (
            <span className="text-sm text-crimson-hover">No licence uploaded</span>
          )}
          {organizer.idDocUrl && (
            <a
              href={organizer.idDocUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-ink-700 px-4 py-2 text-sm font-medium text-ink-100"
            >
              View ID document ↗
            </a>
          )}
        </div>
      </section>

      {/* Payout */}
      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Payout account</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          {field("Bank", organizer.bankName)}
          {field("Account name", organizer.bankAccountName)}
          {field("Account number", organizer.bankAccountNumber)}
        </dl>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-700 pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Their sales
            </dt>
            <dd className="mt-1 text-lg font-bold text-gold">
              {formatEtb(gmv)} ETB
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">
              Degis fees
            </dt>
            <dd className="mt-1 text-lg font-bold">{formatEtb(fees)} ETB</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-luxe text-ink-500">Orders</dt>
            <dd className="mt-1 text-lg font-bold">{orders.length}</dd>
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Events ({organizer.events.length})</h2>
        {organizer.events.length === 0 ? (
          <p className="mt-3 text-sm text-ink-300">No events created yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {organizer.events.map((event) => {
              const sold = event.tiers.reduce((s, t) => s + t.sold, 0);
              return (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{event.title}</p>
                    <p className="text-xs text-ink-300">
                      {formatEventDate(event.startsAt)} · {event.venue.name} ·{" "}
                      {event.reviewStatus}
                      {event.published ? " · live" : " · not live"}
                    </p>
                  </div>
                  <span className="text-xs text-ink-500">{sold} sold</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {logs.length > 0 && (
        <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-bold">History</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {logs.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-2 text-ink-300">
                <span className="font-mono text-xs text-ink-500">
                  {entry.createdAt.toLocaleDateString("en-GB")}
                </span>
                <span className="font-semibold text-ink-100">{entry.action}</span>
                <span>{entry.actorLabel}</span>
                {entry.note && <span className="text-ink-500">— {entry.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
