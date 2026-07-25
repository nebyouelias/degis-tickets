import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        Your account
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">
        {user.name ?? "Welcome to Degis"}
      </h1>
      <p className="mt-1 text-ink-300">{maskPhone(user.phone)}</p>

      <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-8 text-center shadow-card">
        <p className="font-ethiopic text-2xl text-gold">ድ</p>
        <p className="mt-3 font-semibold">Your tickets live here</p>
        <p className="mt-1 text-sm text-ink-300">
          When you buy a ticket, it appears in this wallet with its QR code —
          arriving in Phase 4.
        </p>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
