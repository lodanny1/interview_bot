// Cognito account creation (Issue #01). Like cognito.ts, this is the only
// place that knows Cognito's error names; callers get a typed result.
import "server-only";
import {
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getClient, computeSecretHash } from "./cognito";
import { getCognitoConfig, type CognitoConfig } from "./cognito-config";

export type SignUpFailureReason =
  | "email_taken"
  | "invalid_password"
  | "invalid_details"
  | "too_many_attempts"
  | "service_unavailable";

// confirmed=false means Cognito emailed a verification code that must be
// entered before the user can sign in.
export type SignUpResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; reason: SignUpFailureReason };

export type ConfirmFailureReason =
  | "invalid_code"
  | "expired_code"
  | "too_many_attempts"
  | "service_unavailable";

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: ConfirmFailureReason };

export type ResendResult =
  | { ok: true }
  | { ok: false; reason: "too_many_attempts" | "service_unavailable" };

const TOO_MANY_ATTEMPTS_ERRORS = new Set([
  "LimitExceededException",
  "TooManyRequestsException",
  "TooManyFailedAttemptsException",
]);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function secretHashFor(config: CognitoConfig, email: string) {
  return config.clientSecret
    ? { SecretHash: computeSecretHash(email, config.clientId, config.clientSecret) }
    : {};
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<SignUpResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito sign-up unavailable: configuration is incomplete.");
    return { ok: false, reason: "service_unavailable" };
  }

  try {
    const response = await getClient(config.region).send(
      new SignUpCommand({
        ClientId: config.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
        ],
        ...secretHashFor(config, email),
      })
    );
    return { ok: true, confirmed: response.UserConfirmed === true };
  } catch (error) {
    const name = errorName(error);
    if (name === "UsernameExistsException" || name === "AliasExistsException") {
      return { ok: false, reason: "email_taken" };
    }
    if (name === "InvalidPasswordException") {
      return { ok: false, reason: "invalid_password" };
    }
    if (name === "InvalidParameterException") {
      return { ok: false, reason: "invalid_details" };
    }
    if (TOO_MANY_ATTEMPTS_ERRORS.has(name)) {
      return { ok: false, reason: "too_many_attempts" };
    }
    // Log only the error name: messages could echo request details.
    console.error(`Cognito sign-up failed: ${name}`);
    return { ok: false, reason: "service_unavailable" };
  }
}

export async function confirmSignUp(
  email: string,
  code: string
): Promise<ConfirmResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito confirmation unavailable: configuration is incomplete.");
    return { ok: false, reason: "service_unavailable" };
  }

  try {
    await getClient(config.region).send(
      new ConfirmSignUpCommand({
        ClientId: config.clientId,
        Username: email,
        ConfirmationCode: code,
        ...secretHashFor(config, email),
      })
    );
    return { ok: true };
  } catch (error) {
    const name = errorName(error);
    if (name === "CodeMismatchException") {
      return { ok: false, reason: "invalid_code" };
    }
    if (name === "ExpiredCodeException") {
      return { ok: false, reason: "expired_code" };
    }
    // Cognito answers NotAuthorizedException when the account is already
    // confirmed (e.g. a double submit). Signing in will verify the password.
    if (name === "NotAuthorizedException") {
      return { ok: true };
    }
    if (TOO_MANY_ATTEMPTS_ERRORS.has(name)) {
      return { ok: false, reason: "too_many_attempts" };
    }
    console.error(`Cognito confirmation failed: ${name}`);
    return { ok: false, reason: "service_unavailable" };
  }
}

export async function resendConfirmationCode(email: string): Promise<ResendResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito resend unavailable: configuration is incomplete.");
    return { ok: false, reason: "service_unavailable" };
  }

  try {
    await getClient(config.region).send(
      new ResendConfirmationCodeCommand({
        ClientId: config.clientId,
        Username: email,
        ...secretHashFor(config, email),
      })
    );
    return { ok: true };
  } catch (error) {
    const name = errorName(error);
    if (TOO_MANY_ATTEMPTS_ERRORS.has(name)) {
      return { ok: false, reason: "too_many_attempts" };
    }
    console.error(`Cognito resend failed: ${name}`);
    return { ok: false, reason: "service_unavailable" };
  }
}
