"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const oauthErrors: Record<string, string> = {
  google: "Google sign-in didn't complete. Try again.",
  email: "We couldn't get a verified email from Google.",
  config: "Google sign-in isn't configured yet.",
};

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    oauthErrors[searchParams.get("error") ?? ""] ?? null
  );
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setNormalizedPhone(data.phone);
      setDevCode(data.devCode ?? null);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push("/account");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="text-center font-ethiopic text-2xl text-gold">ድ</p>
      <h1 className="mt-4 text-center text-3xl font-extrabold">
        {step === "phone" ? "Sign in to Degis" : "Enter your code"}
      </h1>
      <p className="mt-2 text-center text-sm text-ink-300">
        {step === "phone"
          ? "No passwords. Use your phone number or Google."
          : `We sent a 6-digit code to ${normalizedPhone}.`}
      </p>

      <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 shadow-card">
        {step === "phone" ? (
          <>
            <a
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink-700 bg-ink-800 py-3 text-sm font-semibold text-ink-100 transition-colors hover:border-ink-500"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#FFC107"
                  d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"
                />
              </svg>
              Continue with Google
            </a>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-700" />
              <span className="text-xs uppercase tracking-luxe text-ink-500">
                or
              </span>
              <div className="h-px flex-1 bg-ink-700" />
            </div>

            <label
              htmlFor="phone"
              className="text-xs font-medium uppercase tracking-luxe text-ink-500"
            >
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09XX XXX XXX or +251…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && requestCode()}
              className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson"
            />
            <button
              type="button"
              onClick={requestCode}
              disabled={busy || phone.trim().length < 9}
              className="mt-4 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            {devCode && (
              <div className="mb-4 rounded-xl border border-gold/40 bg-gold-faint p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-luxe text-gold">
                  Dev mode — your code
                </p>
                <p className="mt-1 text-2xl font-bold tracking-[0.3em] text-gold">
                  {devCode}
                </p>
              </div>
            )}
            <label
              htmlFor="code"
              className="text-xs font-medium uppercase tracking-luxe text-ink-500"
            >
              6-digit code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && !busy && verifyCode()}
              className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson"
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={busy || code.length !== 6}
              className="mt-4 w-full rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setDevCode(null);
                setError(null);
              }}
              className="mt-3 w-full text-center text-sm text-ink-300 hover:text-ink-100"
            >
              Use a different number
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm text-ink-100">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
