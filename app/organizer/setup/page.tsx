import { redirect } from "next/navigation";
import { getMyOrganizer } from "@/lib/organizer";
import { SetupForm } from "@/components/organizer/SetupForm";

export const dynamic = "force-dynamic";

export default async function OrganizerSetupPage() {
  const { user, organizer } = await getMyOrganizer();
  if (!user) redirect("/signin");
  if (organizer) redirect("/organizer");

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="text-center font-ethiopic text-2xl text-gold">ድ</p>
      <h1 className="mt-4 text-center text-3xl font-extrabold">
        Sell on Degis
      </h1>
      <p className="mt-2 text-center text-sm text-ink-300">
        Set up your organizer profile to create events, sell VIP tables, and take
        payments with Telebirr.
      </p>
      <SetupForm defaultPhone={user.phone ?? undefined} />
    </div>
  );
}
