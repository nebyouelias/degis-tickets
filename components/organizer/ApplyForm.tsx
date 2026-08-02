"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/organizer/FileUpload";

const BUSINESS_TYPES = [
  ["SOLE_PROPRIETOR", "Sole proprietor"],
  ["PLC", "PLC"],
  ["SHARE_COMPANY", "Share company"],
  ["NGO", "NGO"],
  ["ASSOCIATION", "Association"],
  ["CHURCH", "Church / religious body"],
  ["GOVERNMENT", "Government body"],
  ["OTHER", "Other"],
] as const;

const BANKS = [
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Bank of Abyssinia",
  "Wegagen Bank",
  "United Bank (Hibret)",
  "Nib International Bank",
  "Cooperative Bank of Oromia",
  "Zemen Bank",
  "Berhan Bank",
  "Abay Bank",
  "Other",
];

type Step = 1 | 2 | 3;

export function ApplyForm({
  defaultPhone,
  defaultEmail,
  defaultName,
}: {
  defaultPhone?: string;
  defaultEmail?: string;
  defaultName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    // 1 — business
    name: "",
    legalName: "",
    businessType: "SOLE_PROPRIETOR",
    tin: "",
    city: "Addis Ababa",
    address: "",
    description: "",
    // 2 — documents
    licenseNumber: "",
    licenseUrl: "",
    idDocUrl: "",
    // 3 — contact & payout
    contactName: defaultName ?? "",
    phone: defaultPhone ?? "",
    email: defaultEmail ?? "",
    telegram: "",
    website: "",
    bankName: "Commercial Bank of Ethiopia",
    bankAccountName: "",
    bankAccountNumber: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const step1Ok = form.name.trim().length >= 2 && form.legalName.trim().length >= 2;
  const step2Ok = form.licenseUrl.length > 0;
  const step3Ok =
    form.phone.trim().length >= 9 &&
    form.bankName.length > 0 &&
    form.bankAccountNumber.trim().length >= 5 &&
    form.bankAccountName.trim().length >= 2;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit.");
      router.push("/organizer");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const input =
    "mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-ink-100 placeholder-ink-500 outline-none transition-colors focus:border-crimson";
  const label = "text-xs font-medium uppercase tracking-luxe text-ink-500";

  return (
    <div>
      {/* Progress */}
      <ol className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step >= n
                  ? "bg-crimson text-ink-100"
                  : "border border-ink-700 text-ink-500"
              }`}
            >
              {n}
            </span>
            {n < 3 && (
              <span
                className={`h-px flex-1 ${step > n ? "bg-crimson" : "bg-ink-700"}`}
              />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-300">
        {step === 1
          ? "Step 1 of 3 · About your business"
          : step === 2
            ? "Step 2 of 3 · Documents"
            : "Step 3 of 3 · Contact & payout"}
      </p>

      {/* Step 1 */}
      {step === 1 && (
        <section className="mt-6 space-y-4 rounded-card border border-ink-700 bg-ink-900 p-6">
          <div>
            <label htmlFor="name" className={label}>
              Display name (what buyers see)
            </label>
            <input
              id="name"
              className={input}
              placeholder="Sheger Events"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="legalName" className={label}>
              Registered legal name
            </label>
            <input
              id="legalName"
              className={input}
              placeholder="Sheger Entertainment PLC"
              value={form.legalName}
              onChange={(e) => set("legalName", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="businessType" className={label}>
                Business type
              </label>
              <select
                id="businessType"
                className={input}
                value={form.businessType}
                onChange={(e) => set("businessType", e.target.value)}
              >
                {BUSINESS_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tin" className={label}>
                TIN — optional
              </label>
              <input
                id="tin"
                className={input}
                placeholder="0001234567"
                value={form.tin}
                onChange={(e) => set("tin", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={label}>
                City
              </label>
              <input
                id="city"
                className={input}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="address" className={label}>
                Address — optional
              </label>
              <input
                id="address"
                className={input}
                placeholder="Bole Road"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className={label}>
              What kind of events do you run?
            </label>
            <textarea
              id="description"
              rows={3}
              className={input}
              placeholder="Monthly lounge nights in Bole and two large concerts a year."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </section>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <section className="mt-6 space-y-5 rounded-card border border-ink-700 bg-ink-900 p-6">
          <div>
            <label htmlFor="licenseNumber" className={label}>
              Trade licence number — optional
            </label>
            <input
              id="licenseNumber"
              className={input}
              value={form.licenseNumber}
              onChange={(e) => set("licenseNumber", e.target.value)}
            />
          </div>
          <div>
            <p className={label}>Trade licence document (required)</p>
            <div className="mt-2">
              <FileUpload
                value={form.licenseUrl}
                onChange={(url) => set("licenseUrl", url)}
                kind="document"
                title="Upload trade licence"
                hint="PDF or photo · up to 8 MB"
              />
            </div>
          </div>
          <div>
            <p className={label}>Owner ID or passport — optional but speeds up review</p>
            <div className="mt-2">
              <FileUpload
                value={form.idDocUrl}
                onChange={(url) => set("idDocUrl", url)}
                kind="document"
                title="Upload ID document"
                hint="PDF or photo · up to 8 MB"
              />
            </div>
          </div>
          <p className="rounded-xl border border-ink-700 bg-ink-800 p-3 text-xs text-ink-300">
            Documents are used only to verify your business and are visible only
            to the Degis review team.
          </p>
        </section>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <section className="mt-6 space-y-4 rounded-card border border-ink-700 bg-ink-900 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contactName" className={label}>
                Contact person
              </label>
              <input
                id="contactName"
                className={input}
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="phone" className={label}>
                Contact phone
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                className={input}
                placeholder="09XX XXX XXX"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className={label}>
                Email — optional
              </label>
              <input
                id="email"
                type="email"
                className={input}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="telegram" className={label}>
                Telegram channel — optional
              </label>
              <input
                id="telegram"
                className={input}
                placeholder="@shegerevents"
                value={form.telegram}
                onChange={(e) => set("telegram", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gold/25 bg-gold-faint/30 p-4">
            <p className="text-xs font-medium uppercase tracking-luxe text-gold">
              Where we send your money
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bankName" className={label}>
                  Bank
                </label>
                <select
                  id="bankName"
                  className={input}
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                >
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bankAccountName" className={label}>
                  Account name
                </label>
                <input
                  id="bankAccountName"
                  className={input}
                  value={form.bankAccountName}
                  onChange={(e) => set("bankAccountName", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="bankAccountNumber" className={label}>
                Account number
              </label>
              <input
                id="bankAccountNumber"
                inputMode="numeric"
                className={input}
                value={form.bankAccountNumber}
                onChange={(e) => set("bankAccountNumber", e.target.value)}
              />
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-crimson/40 bg-crimson-muted/40 p-3 text-center text-sm">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="rounded-full border border-ink-700 px-6 py-3 text-sm font-medium text-ink-300 transition-colors hover:text-ink-100"
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={step === 1 ? !step1Ok : !step2Ok}
            className="flex-1 rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy || !step3Ok}
            className="flex-1 rounded-full bg-crimson py-3 text-sm font-semibold transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        You can start building your events straight away. Publishing unlocks once
        the Degis team approves your account — usually within 2 business days.
      </p>
    </div>
  );
}
