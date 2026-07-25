"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          ? "No passwords. We'll text a code to your phone."
          : `We sent a 6-digit code to ${normalizedPhone}.`}
      </p>

      <div className="mt-8 rounded-card border border-ink-700 bg-ink-900 p-6 shadow-card">
        {step === "phone" ? (
          <>
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
