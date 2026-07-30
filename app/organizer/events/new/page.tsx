import Link from "next/link";
import { requireOrganizer } from "@/lib/organizer";
import { EventForm } from "@/components/organizer/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link
        href="/organizer"
        className="text-sm text-ink-300 transition-colors hover:text-ink-100"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Create an event</h1>
      <p className="mt-2 text-sm text-ink-300">
        Tickets go on sale the moment you publish.
      </p>
      <div className="mt-8">
        <EventForm />
      </div>
    </div>
  );
}
