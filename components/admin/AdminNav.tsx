import Link from "next/link";

export function AdminNav({ active }: { active: string }) {
  const items = [
    ["/admin", "Overview"],
    ["/admin/organizers", "Organizers"],
    ["/admin/events", "Events"],
    ["/admin/lookup", "Lookup"],
  ] as const;

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            active === href
              ? "border-crimson bg-crimson text-ink-100"
              : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
