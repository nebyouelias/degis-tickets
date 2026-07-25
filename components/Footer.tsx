export function Footer() {
  return (
    <footer className="border-t border-ink-700/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center">
        <span className="font-ethiopic text-xl text-gold" aria-hidden>
          ድ
        </span>
        <p className="text-sm text-ink-300">
          Degis Tickets — the official home of Ethiopian events.
        </p>
        <p className="text-xs text-ink-500">
          © {new Date().getFullYear()} Degis. Addis Ababa.
        </p>
      </div>
    </footer>
  );
}
