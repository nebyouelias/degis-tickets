import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entryIsOpen, entryOpensAt } from "@/lib/ticket-crypto";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const GOLD_KINDS = new Set(["VIP", "VVIP", "TABLE"]);

function untilLabel(opensAt: Date): string {
  const ms = opensAt.getTime() - Date.now();
  if (ms <= 0) return "ready";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `in ${Math.floor(hours / 24)}d`;
  if (hours >= 1) return `in ${hours}h`;
  return `in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const tickets = await db.ticket.findMany({
    // Ownership, not purchase — a transferred ticket leaves the buyer's wallet.
    // The OR covers tickets issued before ownership tracking existed.
    where: {
      status: { not: "VOID" },
      OR: [
        { ownerId: user.id },
        { ownerId: null, order: { is: { userId: user.id } } },
      ],
    },
    include: { tier: true, event: { include: { venue: true } } },
    orderBy: [{ event: { startsAt: "asc" } }, { seq: "asc" }],
  });

  const groups = new Map<string, typeof tickets>();
  for (const ticket of tickets) {
    const list = groups.get(ticket.eventId) ?? [];
    list.push(ticket);
    groups.set(ticket.eventId, list);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Ticket wallet
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Your tickets</h1>

      {groups.size === 0 ? (
        <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-10 text-center shadow-card">
          <p className="font-ethiopic text-2xl text-gold">ድ</p>
          <p className="mt-3 font-semibold">No tickets yet</p>
          <p className="mt-1 text-sm text-ink-300">
            Once you complete a purchase, your tickets appear here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-crimson px-5 py-2 text-sm font-semibold transition-colors hover:bg-crimson-hover"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {Array.from(groups.entries()).map(([eventId, group]) => {
            const event = group[0].event;
            const isOpen = entryIsOpen(event.startsAt);
            const opensAt = entryOpensAt(event.startsAt);
            return (
              <section key={eventId}>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink-700">
                    <Image
                      src={event.coverImage}
                      alt={event.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold leading-snug">
                      {event.title}
                    </h2>
                    <p className="text-sm text-ink-300">
                      {formatEventDate(event.startsAt)} · {event.venue.name}
                    </p>
                    <p className="mt-1 text-xs">
                      {isOpen ? (
                        <span className="font-semibold text-gold">
                          ● Entry codes live
                        </span>
                      ) : (
                        <span className="text-ink-500">
                          Entry unlocks {untilLabel(opensAt)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {group.map((ticket) => {
                    const gold = GOLD_KINDS.has(ticket.tier.kind);
                    return (
                      <li key={ticket.id}>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                            gold
                              ? "border-gold/25 bg-gold-faint/40 hover:border-gold/50"
                              : "border-ink-700 bg-ink-900 hover:border-ink-500"
                          }`}
                        >
                          <div>
                            <p className="flex items-center gap-2 font-semibold">
                              {ticket.tier.name}
                              {gold && (
                                <span className="rounded-full border border-gold/40 bg-gold-faint px-2 py-0.5 text-[10px] font-bold text-gold">
                                  {ticket.tier.kind}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 font-mono text-sm text-ink-300">
                              {ticket.code}
                            </p>
                          </div>
                          <span className="text-sm text-ink-300">
                            {ticket.status === "CHECKED_IN"
                              ? "Checked in"
                              : ticket.status === "VOID"
                                ? "Void"
                                : isOpen
                                  ? "Show code →"
                                  : "View →"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
