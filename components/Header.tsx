import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gold-faint font-ethiopic text-lg font-bold text-gold"
          >
            ድ
          </span>
          <span className="text-sm font-semibold uppercase tracking-luxe text-ink-100">
            Degis
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-300 md:flex">
          <Link href="/" className="transition-colors hover:text-ink-100">
            Events
          </Link>
          <Link href="/?q=football" className="transition-colors hover:text-ink-100">
            Football
          </Link>
          <Link href="/?q=nightlife" className="transition-colors hover:text-ink-100">
            Nightlife
          </Link>
          {user && (
            <Link href="/tickets" className="transition-colors hover:text-ink-100">
              My tickets
            </Link>
          )}
        </nav>

        {user ? (
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-full border border-ink-700 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-gold/40"
          >
            <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
            My account
          </Link>
        ) : (
          <Link
            href="/signin"
            className="rounded-full bg-crimson px-5 py-2 text-sm font-semibold text-ink-100 transition-colors hover:bg-crimson-hover"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
