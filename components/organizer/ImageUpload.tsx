"use client";

import { useRef, useState } from "react";

/** Cover image picker: uploads to blob storage and returns a public URL. */
export function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
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

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Event cover"
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-ink-950/80 p-2 backdrop-blur">
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
          className="flex h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-800 transition-colors hover:border-gold/40 disabled:opacity-50"
        >
          <span className="font-ethiopic text-2xl text-gold">ድ</span>
          <span className="mt-2 text-sm font-medium">
            {busy ? "Uploading…" : "Upload event poster"}
          </span>
          <span className="mt-1 text-xs text-ink-500">JPG, PNG or WebP · up to 5 MB</span>
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
