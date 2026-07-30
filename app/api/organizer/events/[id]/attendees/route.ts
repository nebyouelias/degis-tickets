import { db } from "@/lib/db";
import { getMyOrganizer, getOwnedEvent } from "@/lib/organizer";

export const dynamic = "force-dynamic";

/** CSV export of issued tickets — the door list organizers actually want. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { user, organizer } = await getMyOrganizer();
  if (!user || !organizer) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await getOwnedEvent(params.id, organizer.id);
  if (!event) return new Response("Not found", { status: 404 });

  const tickets = await db.ticket.findMany({
    where: { eventId: event.id },
    include: { tier: true, order: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const esc = (v: string | null | undefined) => {
    const s = (v ?? "").replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const rows = [
    [
      "ticket_code",
      "ticket_type",
      "status",
      "checked_in_at",
      "buyer_name",
      "buyer_phone",
      "channel",
      "order_id",
      "issued_at",
    ].join(","),
    ...tickets.map((t) =>
      [
        esc(t.code),
        esc(t.tier.name),
        esc(t.status),
        esc(t.checkedInAt?.toISOString() ?? ""),
        esc(t.order.user.name),
        esc(t.order.deliveryPhone || t.order.user.phone),
        esc(t.order.channel),
        esc(t.order.id.slice(-8).toUpperCase()),
        esc(t.createdAt.toISOString()),
      ].join(",")
    ),
  ].join("\n");

  const filename = `${event.slug}-attendees.csv`;
  return new Response(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
