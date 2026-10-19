"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateLogin, type LoginFieldErrors } from "@/lib/auth/login-validation";
import {
  INITIAL_LOGIN_FORM_STATE,
  type LoginAction,
  type LoginFormState,
} from "@/lib/auth/login-form-state";
import { GoogleIcon } from "./GoogleIcon";

interface LoginFormProps {
  action: LoginAction;
}

export function LoginForm({ action }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
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
    <form onSubmit={handleSubmit} noValidate className="su-form">
      {/* Placeholders until Cognito federation is set up. */}
      <div className="su-providers">
        <button
          type="button"
          className="su-provider"
          disabled
          title="Google sign-in is coming soon"
        >
          <GoogleIcon /> Google
        </button>
        <button
          type="button"
          className="su-provider"
          onClick={() => emailInput.current?.focus()}
        >
          <Mail size={16} aria-hidden="true" /> Email
        </button>
      </div>

      <p className="su-divider">Or login with email</p>

      {formError && (
        <p role="alert" className="su-alert su-alert-error">
          {formError}
        </p>
      )}

      <LoginField
        id="email"
        label="Work or personal email"
        error={fieldErrors.email}
        icon={<Mail size={18} />}
      >
        <input
          ref={emailInput}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="su-input"
        />
      </LoginField>

      <LoginField
        id="password"
        label="Password"
        error={fieldErrors.password}
        icon={<LockKeyhole size={18} />}
        after={
          <button
            type="button"
            className="su-eye"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      >
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className="su-input"
        />
      </LoginField>

      <Link href="/forgot-password" className="su-link login-forgot">
        Forgot password?
      </Link>

      <button type="submit" disabled={pending} className="su-submit login-submit">
        {pending ? "Signing in…" : "Sign In"}
        {!pending && <ArrowRight size={18} aria-hidden="true" />}
      </button>
    </form>
  );
}

function LoginField({
  id,
  label,
  error,
  icon,
  after,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icon: ReactNode;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="su-field">
      <label htmlFor={id} className="su-label">
        {label}
      </label>
      <div className={cn("su-input-wrap", error && "su-input-error")}>
        <span className="su-input-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
        {after}
      </div>
      {error && (
        <p id={`${id}-error`} className="su-error">
          {error}
        </p>
      )}
    </div>
  );
}
