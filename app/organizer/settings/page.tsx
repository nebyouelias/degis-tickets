import Link from "next/link";
import { requireOrganizer } from "@/lib/organizer";
import { OrganizerNav } from "@/components/organizer/OrganizerNav";
import { StatusBanner } from "@/components/organizer/StatusBanner";

export const dynamic = "force-dynamic";

export default async function OrganizerSettings() {
  const { organizer } = await requireOrganizer();

  const field = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-xs uppercase tracking-luxe text-ink-500">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-luxe text-crimson-hover">
        {organizer.name}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">Settings</h1>
      <div className="mt-5">
        <OrganizerNav active="/organizer/settings" />
      </div>

      <StatusBanner status={organizer.status} reviewNote={organizer.reviewNote} />

      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Account status</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              organizer.status === "APPROVED"
                ? "border-gold/40 bg-gold-faint text-gold"
                : "border-ink-700 bg-ink-800 text-ink-300"
            }`}
          >
            {organizer.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-300">
          {organizer.status === "APPROVED"
            ? "Your account is verified. You can publish events and sell tickets."
            : "Publishing unlocks once the Degis team approves your account."}
        </p>
      </section>

      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Business details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {field("Display name", organizer.name)}
          {field("Legal name", organizer.legalName)}
          {field("Business type", organizer.businessType.replace(/_/g, " "))}
          {field("TIN", organizer.tin)}
          {field("Licence number", organizer.licenseNumber)}
          {field("City", organizer.city)}
          {field("Address", organizer.address)}
          {field("Contact person", organizer.contactName)}
          {field("Phone", organizer.phone)}
          {field("Email", organizer.email)}
          {field("Telegram", organizer.telegram)}
          {field("Website", organizer.website)}
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-gold/25 bg-ink-900 p-6">
        <h2 className="font-bold">Payout account</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          {field("Bank", organizer.bankName)}
          {field("Account name", organizer.bankAccountName)}
          {field(
            "Account number",
            organizer.bankAccountNumber
              ? `••••${organizer.bankAccountNumber.slice(-4)}`
              : null
          )}
        </dl>
        <p className="mt-4 text-xs text-ink-500">
          Settlement runs on the schedule agreed with Degis. To change these
          details, contact support — bank changes need re-verification.
        </p>
      </section>

      <section className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-bold">Documents on file</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {organizer.licenseUrl ? (
            <a
              href={organizer.licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-ink-700 px-4 py-2 text-sm text-ink-100"
            >
              Trade licence ↗
            </a>
          ) : (
            <span className="text-sm text-ink-300">No licence on file</span>
          )}
          {organizer.idDocUrl && (
            <a
              href={organizer.idDocUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-ink-700 px-4 py-2 text-sm text-ink-100"
            >
              ID document ↗
            </a>
          )}
        </div>
      </section>

      <p className="mt-8 text-sm text-ink-300">
        Need something changed?{" "}
        <Link href="/organizer" className="font-semibold text-ink-100 underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
