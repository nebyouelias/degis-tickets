"use client";

import { useRef, useState } from "react";

/** Generic uploader used for posters (images) and documents (images or PDF). */
export function FileUpload({
  value,
  onChange,
  kind = "poster",
  title,
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  kind?: "poster" | "document";
  title?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDoc = kind === "document";
  const accept = isDoc
    ? "application/pdf,image/jpeg,image/png,image/webp"
    : "image/jpeg,image/png,image/webp";

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const isPdf = value.toLowerCase().endsWith(".pdf");

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          {isPdf ? (
            <div className="flex items-center gap-3 bg-ink-800 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/40 bg-gold-faint text-xs font-bold text-gold">
                PDF
              </span>
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-sm text-ink-100 underline-offset-2 hover:underline"
              >
                View uploaded document
              </a>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="" className="h-40 w-full object-cover" />
          )}
          <div className="flex gap-2 border-t border-ink-700 bg-ink-900 p-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex-1 rounded-full border border-ink-700 py-2 text-xs font-medium disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-full border border-ink-700 px-4 py-2 text-xs text-ink-300"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-800 transition-colors hover:border-gold/40 disabled:opacity-50"
        >
          <span className="font-ethiopic text-2xl text-gold">ድ</span>
          <span className="mt-2 text-sm font-medium">
            {busy ? "Uploading…" : (title ?? "Upload file")}
          </span>
          <span className="mt-1 text-xs text-ink-500">
            {hint ?? "JPG, PNG or WebP · up to 8 MB"}
          </span>
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-2.5 text-center text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
