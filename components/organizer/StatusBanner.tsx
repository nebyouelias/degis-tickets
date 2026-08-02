import Link from "next/link";

/** Tells an organizer exactly where they stand and what unlocks next. */
export function StatusBanner({
  status,
  reviewNote,
}: {
  status: string;
  reviewNote?: string | null;
}) {
  if (status === "APPROVED") return null;

  const view = {
    PENDING: {
      cls: "border-gold/30 bg-gold-faint/40",
      title: "Your account is under review",
      body: "You can create events and set up tickets now. Publishing and selling unlock as soon as we approve you — usually within 2 business days.",
    },
    REJECTED: {
      cls: "border-crimson/40 bg-crimson-muted/30",
      title: "Your application was not approved",
      body:
        reviewNote ??
        "Contact Degis support to find out what is needed and reapply.",
    },
    SUSPENDED: {
      cls: "border-crimson/40 bg-crimson-muted/30",
      title: "Your account is suspended",
      body:
        reviewNote ??
        "Your events are off sale. Contact Degis support to resolve this.",
    },
  }[status];

  if (!view) return null;

  return (
    <div className={`mt-6 rounded-card border p-5 ${view.cls}`}>
      <p className="font-semibold">{view.title}</p>
      <p className="mt-1 text-sm text-ink-300">{view.body}</p>
      {status !== "PENDING" && (
        <Link
          href="/organizer/settings"
          className="mt-3 inline-block text-sm font-semibold text-ink-100 underline-offset-4 hover:underline"
        >
          Review your details →
        </Link>
      )}
    </div>
  );
}
