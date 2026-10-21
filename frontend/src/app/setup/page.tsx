// Complete User Setup page (Issue #05). New accounts land here after signup.
// Loads any saved setup info so returning users see their answers (Scenario 3).

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session-cookie";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { SetupForm } from "@/components/setup/SetupForm";
import { loadUserSetup } from "@/lib/setup/user-setup-api";
import {
  parseExperienceLevel,
  parseFocusAreas,
} from "@/lib/setup/setup-validation";
import {
  EMPTY_SETUP_VALUES,
  type SetupInitialValues,
} from "@/lib/setup/setup-form-state";
import { completeSetupAction } from "./actions";

export const metadata: Metadata = {
  title: "Set Up Your Profile - Phyyve",
};

export default async function SetupPage() {
  // Read the cookie first, outside any try/catch, so Next.js always renders
  // this page per request instead of prerendering it at build time.
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = idToken ? await readSession() : null;
  if (!idToken || !session) {
    redirect("/login");
  }

  const loaded = await loadUserSetup(idToken);

  if (!loaded.ok && loaded.reason === "unauthenticated") {
    redirect("/login");
  }

  // If loading fails, still show an empty form; saving reports its own errors.
  const profile = loaded.ok ? loaded.status.profile : null;
  const initialValues: SetupInitialValues = profile
    ? {
        targetRole: profile.target_role ?? "",
        experienceLevel: parseExperienceLevel(profile.experience_level),
        focusAreas: parseFocusAreas(profile.focus_areas),
        targetCompany: profile.target_company ?? "",
        bio: profile.bio ?? "",
      }
    : EMPTY_SETUP_VALUES;

  const firstName = session.name?.trim().split(/\s+/)[0];
  const isReturning = loaded.ok && loaded.status.setupCompleted === true;

  return (
    <main className="min-h-screen bg-app px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-tertiary">
            {isReturning ? "Your profile" : "Step 1 of 1 · Profile setup"}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-primary">
            {isReturning
              ? "Update your interview profile"
              : `Welcome${firstName ? `, ${firstName}` : ""}! Let's personalize your practice.`}
          </h1>
          <p className="mt-3 text-lg text-tertiary">
            Tell us what you&apos;re preparing for, and Interview Bot will tailor questions
            and feedback to you. You can change this later.
          </p>
        </header>

        <section
          aria-labelledby="setup-form-title"
          className="rounded-2xl border border-line-subtle bg-card p-8 shadow-sm"
        >
          <SetupForm action={completeSetupAction} initialValues={initialValues} />
        </section>
      </div>
    </main>
  );
}
