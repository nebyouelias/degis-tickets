import { redirect } from "next/navigation";

/** Legacy path — the onboarding flow now lives at /organizer/apply. */
export default function LegacySetupRedirect() {
  redirect("/organizer/apply");
}
