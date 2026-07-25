import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
          {/* Brandmark: ድ in dark gold — recognizable without text */}
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gold-faint font-ethiopic text-lg font-bold text-gold"
          >
            ድ
          </span>
          <span className="text-sm font-semibold tracking-luxe text-ink-100 uppercase">
            Degis
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-300 md:flex">
          <Link href="/" className="transition-colors hover:text-ink-100">
            Events
          </Link>
          <span className="cursor-not-allowed opacity-50">Football</span>
          <span className="cursor-not-allowed opacity-50">Nightlife</span>
          <span className="cursor-not-allowed opacity-50">For organizers</span>
        </nav>

        <button
          type="button"
          className="rounded-full bg-crimson px-5 py-2 text-sm font-semibold text-ink-100 transition-colors hover:bg-crimson-hover"
        >
          Sign in
        </button>
      </div>
    </header>
  );
}
