"use client";

// Complete User Setup form (Issue #05). Collects what Interview Bot needs to
// personalize practice: target role, experience level and focus areas
// (required), plus target company and extra context (optional).
// The logic follows SignUpForm: validate in the browser, then the server
// action validates again, saves, and redirects to the dashboard.

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  FOCUS_AREAS,
  SETUP_LIMITS,
  validateSetup,
  type ExperienceLevel,
  type FocusArea,
  type SetupFieldErrors,
} from "@/lib/setup/setup-validation";
import {
  INITIAL_SETUP_FORM_STATE,
  type SetupAction,
  type SetupFormState,
  type SetupInitialValues,
} from "@/lib/setup/setup-form-state";

interface SetupFormProps {
  action: SetupAction;
  initialValues: SetupInitialValues;
}

const inputClass =
  "h-11 w-full rounded-lg border bg-card px-3 text-sm text-primary placeholder:text-placeholder " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export function SetupForm({ action, initialValues }: SetupFormProps) {
  const [targetRole, setTargetRole] = useState(initialValues.targetRole);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">(
    initialValues.experienceLevel
  );
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(initialValues.focusAreas);
  const [targetCompany, setTargetCompany] = useState(initialValues.targetCompany);
  const [bio, setBio] = useState(initialValues.bio);

  // Errors from client-side checks, when the action is never called.
  const [clientErrors, setClientErrors] = useState<SetupFieldErrors>({});

  const [state, formAction, pending] = useActionState(
    async (prevState: SetupFormState, formData: FormData) => {
      const nextState = await action(prevState, formData);
      // Success redirects away; guard against an empty result meanwhile.
      return nextState ?? prevState;
    },
    INITIAL_SETUP_FORM_STATE
  );

  function toggleFocusArea(area: FocusArea) {
    setFocusAreas((current) =>
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateSetup({
      targetRole,
      experienceLevel,
      focusAreas,
      targetCompany,
      bio,
    });
    if (!validation.ok) {
      setClientErrors(validation.fieldErrors);
      return;
    }

    setClientErrors({});
    const formData = new FormData();
    formData.set("targetRole", validation.data.targetRole);
    formData.set("experienceLevel", validation.data.experienceLevel);
    for (const area of validation.data.focusAreas) {
      formData.append("focusAreas", area);
    }
    formData.set("targetCompany", validation.data.targetCompany);
    formData.set("bio", validation.data.bio);
    startTransition(() => formAction(formData));
  }

  // Show one error source at a time: current client errors, otherwise the last
  // server result. Hide stale server messages while a new attempt is pending.
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const fieldErrors = hasClientErrors ? clientErrors : pending ? {} : (state.fieldErrors ?? {});
  const formError = pending || hasClientErrors ? undefined : state.formError;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">
      <h2 id="setup-form-title" className="sr-only">
        Profile setup
      </h2>

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-input-error bg-error-bg px-4 py-3 text-sm text-error-text"
        >
          <p>{formError}</p>
          {state.signInAgain && (
            <Link href="/login" className="mt-1 inline-block font-semibold underline">
              Go to Sign In
            </Link>
          )}
        </div>
      )}

      <Field id="targetRole" label="Target role" error={fieldErrors.targetRole}>
        {(describedBy) => (
          <input
            id="targetRole"
            name="targetRole"
            type="text"
            autoComplete="organization-title"
            placeholder="e.g. Software Engineer, Product Manager"
            maxLength={SETUP_LIMITS.targetRole}
            required
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            aria-invalid={fieldErrors.targetRole ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              inputClass,
              fieldErrors.targetRole ? "border-input-error" : "border-input-default"
            )}
          />
        )}
      </Field>

      <ChoiceGroup
        id="experienceLevel"
        legend="Experience level"
        error={fieldErrors.experienceLevel}
      >
        {EXPERIENCE_LEVELS.map((level) => (
          <Choice
            key={level.value}
            type="radio"
            name="experienceLevel"
            value={level.value}
            label={level.label}
            checked={experienceLevel === level.value}
            onChange={() => setExperienceLevel(level.value)}
          />
        ))}
      </ChoiceGroup>

      <ChoiceGroup
        id="focusAreas"
        legend="What do you want to practice?"
        hint="Choose all that apply."
        error={fieldErrors.focusAreas}
      >
        {FOCUS_AREAS.map((area) => (
          <Choice
            key={area.value}
            type="checkbox"
            name="focusAreas"
            value={area.value}
            label={area.label}
            checked={focusAreas.includes(area.value)}
            onChange={() => toggleFocusArea(area.value)}
          />
        ))}
      </ChoiceGroup>

      <Field
        id="targetCompany"
        label="Target company"
        optional
        error={fieldErrors.targetCompany}
      >
        {(describedBy) => (
          <input
            id="targetCompany"
            name="targetCompany"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Google, a local startup"
            maxLength={SETUP_LIMITS.targetCompany}
            value={targetCompany}
            onChange={(event) => setTargetCompany(event.target.value)}
            aria-invalid={fieldErrors.targetCompany ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              inputClass,
              fieldErrors.targetCompany ? "border-input-error" : "border-input-default"
            )}
          />
        )}
      </Field>

      <Field
        id="bio"
        label="Anything else we should know?"
        optional
        hint={`${bio.length}/${SETUP_LIMITS.bio}`}
        error={fieldErrors.bio}
      >
        {(describedBy) => (
          <textarea
            id="bio"
            name="bio"
            rows={4}
            placeholder="e.g. Switching careers from teaching, nervous about technical rounds"
            maxLength={SETUP_LIMITS.bio}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            aria-invalid={fieldErrors.bio ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              inputClass,
              "h-auto resize-y py-2.5",
              fieldErrors.bio ? "border-input-error" : "border-input-default"
            )}
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cta px-6 text-base font-semibold text-white transition-colors hover:bg-cta-hover active:bg-cta-pressed disabled:cursor-not-allowed disabled:bg-cta-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {pending ? "Saving…" : "Finish setup"}
        {!pending && <ArrowRight size={18} aria-hidden="true" />}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-primary">
          {label}
          {optional && <span className="font-normal text-tertiary"> (optional)</span>}
        </label>
        {hint && <span className="font-mono text-[11px] text-tertiary">{hint}</span>}
      </div>
      {children(error ? errorId : undefined)}
      {error && (
        <p id={errorId} className="text-sm text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceGroup({
  id,
  legend,
  hint,
  error,
  children,
}: {
  id: string;
  legend: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="mb-2 text-sm font-semibold text-primary">
        {legend}
        {hint && <span className="ml-2 font-normal text-tertiary">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && (
        <p id={errorId} className="text-sm text-error-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Choice({
  type,
  name,
  value,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring",
        checked
          ? "border-cta bg-tinted font-semibold text-secondary"
          : "border-input-default bg-card text-primary hover:bg-hover"
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {checked && <Check size={14} aria-hidden="true" />}
      {label}
    </label>
  );
}
