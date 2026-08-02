import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import type { OrganizerStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

const badge: Record<string, string> = {
  PENDING: "border-gold/40 bg-gold-faint text-gold",
  APPROVED: "border-emerald-600/40 bg-emerald-950/40 text-emerald-400",
  REJECTED: "border-crimson/40 bg-crimson-muted/40 text-crimson-hover",
  SUSPENDED: "border-crimson/40 bg-crimson-muted/40 text-crimson-hover",
};

export default async function AdminOrganizers({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdmin();

  const filter = STATUSES.includes(searchParams.status as OrganizerStatus)
    ? (searchParams.status as OrganizerStatus)
    : undefined;

  const organizers = await db.organizer.findMany({
    where: filter ? { status: filter } : {},
    include: {
      owner: { select: { phone: true, email: true } },
      _count: { select: { events: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Degis admin
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Organizers</h1>
      <div className="mt-5">
        <AdminNav active="/admin/organizers" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/organizers"
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
            !filter ? "border-ink-500 text-ink-100" : "border-ink-700 text-ink-300"
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/organizers?status=${s}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              filter === s ? "border-ink-500 text-ink-100" : "border-ink-700 text-ink-300"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {organizers.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No organizers in this view.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {organizers.map((org) => (
            <li key={org.id}>
              <Link
                href={`/admin/organizers/${org.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-ink-500"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {org.name}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge[org.status]}`}
                    >
                      {org.status}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-300">
                    {org.legalName ?? "—"} · {org.city}
                  </p>
                  <p className="text-xs text-ink-500">
                    {org.phone ?? org.owner?.phone ?? "no phone"} ·{" "}
                    {org._count.events} event{org._count.events === 1 ? "" : "s"} ·
                    applied{" "}
                    {org.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span className="text-sm text-ink-300">Review →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
