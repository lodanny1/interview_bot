"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { validateLogin, type LoginFieldErrors } from "@/lib/auth/login-validation";
import {
  INITIAL_LOGIN_FORM_STATE,
  type LoginAction,
  type LoginFormState,
} from "@/lib/auth/login-form-state";

interface LoginFormProps {
  action: LoginAction;
}

export function LoginForm({ action }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Errors from client-side validation, when the action is never called.
  const [clientErrors, setClientErrors] = useState<LoginFieldErrors>({});

  const [state, formAction, pending] = useActionState(
    async (prevState: LoginFormState, formData: FormData) => {
      const nextState = await action(prevState, formData);
      // Success redirects away, so reaching here means the attempt failed.
      // Clear the password explicitly; it is never restored from server state.
      setPassword("");
      // Guard against an empty result while a redirect is in flight.
      return nextState ?? INITIAL_LOGIN_FORM_STATE;
    },
    INITIAL_LOGIN_FORM_STATE
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateLogin({ email, password });
    if (!validation.ok) {
      setClientErrors(validation.fieldErrors);
      return;
    }

    setClientErrors({});
    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    startTransition(() => formAction(formData));
  }

  // Show one error source at a time: current client errors, otherwise the last
  // server result. Hide stale server errors while a new attempt is pending.
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const showServerState = !hasClientErrors && !pending;
  const fieldErrors = hasClientErrors
    ? clientErrors
    : showServerState
      ? (state.fieldErrors ?? {})
      : {};
  const formError = showServerState ? state.formError : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </p>
      )}

      <LoginField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
      />

      <LoginField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

function LoginField({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
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
