import { redirect } from "next/navigation";
import { getMyOrganizer } from "@/lib/organizer";
import { ApplyForm } from "@/components/organizer/ApplyForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const { user, organizer } = await getMyOrganizer();
  if (!user) redirect("/signin?next=/organizer/apply");
  if (organizer) redirect("/organizer");

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-center font-ethiopic text-2xl text-gold">ድ</p>
      <h1 className="mt-4 text-center text-3xl font-extrabold">Sell on Degis</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-300">
        Reach every Degis buyer, sell VIP tables, take Telebirr and card payments,
        and scan tickets at your gate — even offline.
      </p>
      <div className="mt-10">
        <ApplyForm
          defaultPhone={user.phone ?? undefined}
          defaultEmail={user.email ?? undefined}
          defaultName={user.name ?? undefined}
        />
      </div>
    </div>
  );
}
