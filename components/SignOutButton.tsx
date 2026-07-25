"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-300 transition-colors hover:border-crimson hover:text-ink-100"
    >
      Sign out
    </button>
  );
}
