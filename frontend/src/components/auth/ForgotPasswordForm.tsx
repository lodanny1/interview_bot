"use client";

// Password reset form (Issue #04). Two steps:
//   1. "request" - email, then Cognito emails a 6-digit code
//   2. "confirm" - the code and a new password
// The logic follows SignUpForm; the look follows LoginForm.

import { startTransition, useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "@/lib/auth/signup-validation";
import {
  validateNewPassword,
  validateResetEmail,
  type ResetFieldErrors,
} from "@/lib/auth/password-reset-validation";
import {
  INITIAL_RESET_FORM_STATE,
  type ResetAction,
  type ResetFormState,
} from "@/lib/auth/password-reset-form-state";

interface ForgotPasswordFormProps {
  action: ResetAction;
}

export function ForgotPasswordForm({ action }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  // Errors from client-side checks, when the action is never called.
  const [clientErrors, setClientErrors] = useState<ResetFieldErrors>({});
  // True when the user clicks "Use a different email" on the code step.
  const [editingEmail, setEditingEmail] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prevState: ResetFormState, formData: FormData) => {
      const nextState = await action(prevState, formData);
      // A new server answer replaces any "go back" the user did.
      setEditingEmail(false);
      // Never keep a rejected password in the field.
      setPassword("");
      // Success redirects away; guard against an empty result meanwhile.
      return nextState ?? prevState;
    },
    INITIAL_RESET_FORM_STATE
  );

  const step = editingEmail ? "request" : state.step;
  const codeEmail = state.email ?? email.trim().toLowerCase();
  const missingRules = PASSWORD_RULES.filter((rule) => !rule.test(password));

  function submit(values: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value);
    }
    startTransition(() => formAction(formData));
  }

  function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateResetEmail(email);
    if (!validation.ok) {
      setClientErrors({ email: validation.error });
      return;
    }

    setClientErrors({});
    submit({ intent: "request", email: validation.email });
  }

  function handleConfirmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateNewPassword({ code, password });
    if (!validation.ok) {
      setClientErrors(validation.fieldErrors);
      return;
    }

    setClientErrors({});
    submit({ intent: "confirm", email: codeEmail, ...validation.data });
  }

  function handleResend() {
    if (pending) return;
    setClientErrors({});
    setCode("");
    submit({ intent: "resend", email: codeEmail });
  }

  // Show one error source at a time: current client errors, otherwise the last
  // server result. Hide stale server messages while a new attempt is pending.
  const showServerState = !pending && !editingEmail;
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const fieldErrors = hasClientErrors
    ? clientErrors
    : showServerState
      ? (state.fieldErrors ?? {})
      : {};
  const formError = showServerState ? state.formError : undefined;
  const notice = showServerState && !formError ? state.notice : undefined;

  const messages = (
    <>
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {notice}
        </p>
      )}
    </>
  );

  if (step === "confirm") {
    return (
      <form onSubmit={handleConfirmSubmit} noValidate className="space-y-5">
        <p className="text-sm text-gray-500">
          Enter the code sent to <strong className="text-gray-800">{codeEmail}</strong> and
          choose a new password.
        </p>

        {messages}

        <ResetField
          id="code"
          label="Reset code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(value) => setCode(value.replace(/\D/g, ""))}
          error={fieldErrors.code}
        />

        <ResetField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />

        {password && missingRules.length > 0 && (
          <p className="text-xs text-gray-500">
            Still needs: {missingRules.map((rule) => rule.label.toLowerCase()).join(", ")}.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Resetting…" : "Reset Password"}
        </button>

        <div className="flex justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={pending}
            className="font-medium text-gray-700 hover:underline disabled:opacity-60"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setClientErrors({});
              setEditingEmail(true);
            }}
            disabled={pending}
            className="text-gray-500 hover:underline disabled:opacity-60"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestSubmit} noValidate className="space-y-5">
      {messages}

      <ResetField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send Reset Code"}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-gray-700 hover:underline">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}

function ResetField({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300",
          error && "border-red-300 focus:ring-red-200"
        )}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
