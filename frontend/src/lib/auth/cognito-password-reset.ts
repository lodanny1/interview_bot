// Cognito password reset (Issue #04). Like cognito.ts, this is the only place
// that knows Cognito's error names; callers get a typed result.
import "server-only";
import {
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getClient, computeSecretHash } from "./cognito";
import { getCognitoConfig, type CognitoConfig } from "./cognito-config";

export type RequestResetResult =
  | { ok: true }
  | { ok: false; reason: "too_many_attempts" | "service_unavailable" };

export type ConfirmResetFailureReason =
  | "invalid_code"
  | "expired_code"
  | "invalid_password"
  | "too_many_attempts"
  | "service_unavailable";

export type ConfirmResetResult =
  | { ok: true }
  | { ok: false; reason: ConfirmResetFailureReason };

const TOO_MANY_ATTEMPTS_ERRORS = new Set([
  "LimitExceededException",
  "TooManyRequestsException",
  "TooManyFailedAttemptsException",
]);

// Errors that mean "no such account" (or none that can receive a code).
// Reported as success so the form never reveals which emails are registered.
const HIDDEN_ACCOUNT_ERRORS = new Set([
  "UserNotFoundException",
  "InvalidParameterException",
  "NotAuthorizedException",
]);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function secretHashFor(config: CognitoConfig, email: string) {
  return config.clientSecret
    ? { SecretHash: computeSecretHash(email, config.clientId, config.clientSecret) }
    : {};
}

// Asks Cognito to email a 6-digit reset code.
export async function requestPasswordReset(email: string): Promise<RequestResetResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito password reset unavailable: configuration is incomplete.");
    return { ok: false, reason: "service_unavailable" };
  }

  try {
    await getClient(config.region).send(
      new ForgotPasswordCommand({
        ClientId: config.clientId,
        Username: email,
        ...secretHashFor(config, email),
      })
    );
    return { ok: true };
  } catch (error) {
    const name = errorName(error);
    if (HIDDEN_ACCOUNT_ERRORS.has(name)) {
      return { ok: true };
    }
    if (TOO_MANY_ATTEMPTS_ERRORS.has(name)) {
      return { ok: false, reason: "too_many_attempts" };
    }
    // Log only the error name: messages could echo request details.
    console.error(`Cognito password reset request failed: ${name}`);
    return { ok: false, reason: "service_unavailable" };
  }
}

// Sets the new password. Cognito makes each code single-use and expiring.
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<ConfirmResetResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito password reset unavailable: configuration is incomplete.");
    return { ok: false, reason: "service_unavailable" };
  }

  try {
    await getClient(config.region).send(
      new ConfirmForgotPasswordCommand({
        ClientId: config.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        ...secretHashFor(config, email),
      })
    );
    return { ok: true };
  } catch (error) {
    const name = errorName(error);
    // An unknown email can't have a valid code; don't reveal which it was.
    if (name === "CodeMismatchException" || name === "UserNotFoundException") {
      return { ok: false, reason: "invalid_code" };
    }
    if (name === "ExpiredCodeException") {
      return { ok: false, reason: "expired_code" };
    }
    if (name === "InvalidPasswordException") {
      return { ok: false, reason: "invalid_password" };
    }
    if (TOO_MANY_ATTEMPTS_ERRORS.has(name)) {
      return { ok: false, reason: "too_many_attempts" };
    }
    console.error(`Cognito password reset failed: ${name}`);
    return { ok: false, reason: "service_unavailable" };
  }
}
