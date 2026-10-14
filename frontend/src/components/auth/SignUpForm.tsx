"use client";

// Create Account form (Issue #01). Two steps:
//   1. "details" - name, email, password, target role, terms
//   2. "confirm" - the 6-digit code Cognito emails to verify the address
// The logic follows LoginForm; the look follows the SignUp Figma frame.
// Styles live in src/app/signup/signup.css.

import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CircleCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import {
  PASSWORD_RULES,
  passwordStrength,
  validateConfirmationCode,
  validateSignUp,
  type SignUpFieldErrors,
} from "@/lib/auth/signup-validation";
import {
  INITIAL_SIGNUP_FORM_STATE,
  type SignUpAction,
  type SignUpFormState,
} from "@/lib/auth/signup-form-state";

interface SignUpFormProps {
  action: SignUpAction;
}

export function SignUpForm({ action }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [code, setCode] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  // Errors from client-side checks, when the action is never called.
  const [clientErrors, setClientErrors] = useState<SignUpFieldErrors>({});
  const [clientCodeError, setClientCodeError] = useState<string>();
  // True when the user clicks "Use a different email" on the code step.
  const [editingDetails, setEditingDetails] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prevState: SignUpFormState, formData: FormData) => {
      const nextState = await action(prevState, formData);
      // A new server answer replaces any "go back" the user did.
      setEditingDetails(false);
      // Success redirects away; guard against an empty result meanwhile.
      return nextState ?? prevState;
    },
    INITIAL_SIGNUP_FORM_STATE
  );

  const step = editingDetails ? "details" : state.step;
  const codeEmail = state.email ?? email.trim().toLowerCase();
  const strength = passwordStrength(password);
  const missingRules = PASSWORD_RULES.filter((rule) => !rule.test(password));
  // The design has 4 bars for 5 rules, so scale: all 5 rules met = 4 bars.
  const filledBars = password
    ? Math.max(1, Math.round((strength.met * 4) / strength.total))
    : 0;

  function submit(values: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value);
    }
    startTransition(() => formAction(formData));
  }

  function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateSignUp({ name, email, password, targetRole, agreeTerms });
    if (!validation.ok) {
      setClientErrors(validation.fieldErrors);
      return;
    }

    setClientErrors({});
    submit({
      intent: "create",
      name,
      email,
      password,
      targetRole,
      agreeTerms: agreeTerms ? "on" : "",
    });
  }

  function handleConfirmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const validation = validateConfirmationCode(code);
    if (!validation.ok) {
      setClientCodeError(validation.error);
      return;
    }

    setClientCodeError(undefined);
    submit({ intent: "confirm", email: codeEmail, password, code: validation.code });
  }

  function handleResend() {
    if (pending) return;
    setClientCodeError(undefined);
    setCode("");
    submit({ intent: "resend", email: codeEmail });
  }

  // Show one error source at a time: current client errors, otherwise the last
  // server result. Hide stale server messages while a new attempt is pending.
  const showServerState = !pending;
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const fieldErrors = hasClientErrors
    ? clientErrors
    : showServerState && step === "details"
      ? (state.fieldErrors ?? {})
      : {};
  const codeError = clientCodeError ?? (showServerState ? state.codeError : undefined);
  const formError = showServerState && !editingDetails ? state.formError : undefined;
  const notice = showServerState && !editingDetails ? state.notice : undefined;

  const messages = (
    <>
      {formError && (
        <div role="alert" className="su-alert su-alert-error">
          <p>{formError}</p>
          {state.signInInstead && (
            <Link href="/login" className="su-link">
              Go to Sign In
            </Link>
          )}
        </div>
      )}
      {notice && !formError && (
        <p role="status" className="su-alert su-alert-success">
          {notice}
        </p>
      )}
    </>
  );

  if (step === "confirm") {
    return (
      <form onSubmit={handleConfirmSubmit} noValidate className="su-form">
        <header className="su-header">
          <h2 id="signup-title">Check your email</h2>
          <p>
            Enter the 6-digit code we sent to <strong>{codeEmail}</strong> to finish
            creating your account.
          </p>
        </header>

        {messages}

        <Field
          id="code"
          label="Verification code"
          icon={<Lock size={16} />}
          error={codeError}
          input={{
            type: "text",
            inputMode: "numeric",
            autoComplete: "one-time-code",
            maxLength: 6,
            placeholder: "123456",
            value: code,
            onChange: (value) => setCode(value.replace(/\D/g, "")),
          }}
        />

        <button type="submit" disabled={pending} className="su-submit">
          {pending ? "Verifying…" : "Verify and continue"}
          {!pending && <ArrowRight size={18} aria-hidden="true" />}
        </button>

        <div className="su-row-between">
          <button type="button" onClick={handleResend} disabled={pending} className="su-text-button">
            Resend code
          </button>
          <button
            type="button"
            onClick={() => setEditingDetails(true)}
            disabled={pending}
            className="su-text-button su-muted"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit} noValidate className="su-form">
      <header className="su-header">
        <h2 id="signup-title">Create your free account</h2>
        <p>Start practicing in minutes. No credit card required.</p>
      </header>

      <div className="su-providers">
        <button
          type="button"
          className="su-provider"
          disabled
          title="Google sign-up is coming soon"
        >
          <GoogleIcon /> Google
        </button>
        <button
          type="button"
          className="su-provider"
          onClick={() => nameInput.current?.focus()}
        >
          <Mail size={16} aria-hidden="true" /> Email
        </button>
      </div>

      <p className="su-divider">
        <span>Or register with email</span>
      </p>

      {messages}

      <Field
        id="name"
        label="Full name"
        icon={<User size={16} />}
        error={fieldErrors.name}
        inputRef={nameInput}
        input={{
          type: "text",
          autoComplete: "name",
          placeholder: "Alex Morgan",
          value: name,
          onChange: setName,
        }}
      />

      <Field
        id="email"
        label="Email"
        icon={<Mail size={16} />}
        error={fieldErrors.email}
        input={{
          type: "email",
          autoComplete: "email",
          placeholder: "name@example.com",
          value: email,
          onChange: setEmail,
        }}
      />

      <Field
        id="password"
        label="Password"
        hint="Min. 8 characters"
        icon={<Lock size={16} />}
        error={fieldErrors.password}
        describedBy="password-strength"
        input={{
          type: showPassword ? "text" : "password",
          autoComplete: "new-password",
          placeholder: "Create a strong password",
          value: password,
          onChange: setPassword,
        }}
        trailing={
          <button
            type="button"
            className="su-eye"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />

      <div id="password-strength" className="su-strength" aria-live="polite">
        <div className="su-strength-bars" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={
                i < filledBars ? `su-bar su-bar-${strength.label.toLowerCase()}` : "su-bar"
              }
            />
          ))}
        </div>
        {strength.label && (
          <span className={`su-strength-label su-text-${strength.label.toLowerCase()}`}>
            {strength.label}
          </span>
        )}
      </div>
      {password && missingRules.length > 0 && (
        <p className="su-missing">
          Still needs: {missingRules.map((rule) => rule.label.toLowerCase()).join(", ")}.
        </p>
      )}

      <Field
        id="targetRole"
        label="Target role / field"
        optional
        icon={<Briefcase size={16} />}
        input={{
          type: "text",
          autoComplete: "organization-title",
          placeholder: "e.g. Software Engineer, Product Manager",
          value: targetRole,
          onChange: setTargetRole,
        }}
      />

      <div className="su-terms">
        <label className="su-check">
          <input
            type="checkbox"
            name="agreeTerms"
            checked={agreeTerms}
            onChange={(event) => setAgreeTerms(event.target.checked)}
            aria-invalid={fieldErrors.agreeTerms ? true : undefined}
            aria-describedby={fieldErrors.agreeTerms ? "agreeTerms-error" : undefined}
          />
          <span>
            I agree to the <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </span>
        </label>
        {fieldErrors.agreeTerms && (
          <p id="agreeTerms-error" className="su-error">
            {fieldErrors.agreeTerms}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className="su-submit">
        {pending ? "Creating account…" : "Create Account"}
        {!pending && <ArrowRight size={18} aria-hidden="true" />}
      </button>

      <footer className="su-footer">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="su-link">
            Sign in here →
          </Link>
        </p>
        <ul className="su-trust">
          <li><CircleCheck size={14} aria-hidden="true" /> 256-bit encryption</li>
          <li><CircleCheck size={14} aria-hidden="true" /> 7-day full access</li>
          <li><CircleCheck size={14} aria-hidden="true" /> No credit card required</li>
        </ul>
      </footer>
    </form>
  );
}

interface InputProps {
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  maxLength?: number;
}

function Field({
  id,
  label,
  hint,
  optional,
  icon,
  error,
  describedBy,
  input,
  trailing,
  inputRef,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  icon: ReactNode;
  error?: string;
  describedBy?: string;
  input: InputProps;
  trailing?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const errorId = `${id}-error`;
  const describedByIds = [error ? errorId : null, describedBy ?? null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="su-field">
      <div className="su-label-row">
        <label htmlFor={id} className="su-label">
          {label}
          {optional && <span className="su-optional"> (optional)</span>}
        </label>
        {hint && <span className="su-hint">{hint}</span>}
      </div>
      <div className={error ? "su-input-wrap su-input-error" : "su-input-wrap"}>
        <span className="su-input-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={input.type}
          autoComplete={input.autoComplete}
          inputMode={input.inputMode}
          maxLength={input.maxLength}
          placeholder={input.placeholder}
          required={!optional}
          value={input.value}
          onChange={(event) => input.onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className="su-input"
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="su-error">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
