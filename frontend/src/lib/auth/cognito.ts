// Cognito sign-in service. The only module that talks to Cognito or knows its
// error names; callers receive a typed result and never see AWS errors.
import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoConfig } from "./cognito-config";

export interface CognitoTokens {
  idToken: string;
  expiresInSeconds: number;
}

export type SignInFailureReason =
  | "invalid_credentials"
  | "account_action_required"
  | "service_unavailable";

export type SignInResult =
  | { ok: true; tokens: CognitoTokens }
  | { ok: false; reason: SignInFailureReason };

const INVALID_CREDENTIAL_ERRORS = new Set([
  "NotAuthorizedException",
  "UserNotFoundException",
]);

const ACCOUNT_ACTION_ERRORS = new Set([
  "UserNotConfirmedException",
  "PasswordResetRequiredException",
]);

let cachedClient: {
  region: string;
  client: CognitoIdentityProviderClient;
} | null = null;

function getClient(region: string): CognitoIdentityProviderClient {
  if (cachedClient?.region !== region) {
    cachedClient = { region, client: new CognitoIdentityProviderClient({ region }) };
  }
  return cachedClient.client;
}

function computeSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): string {
  return createHmac("sha256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

function failure(reason: SignInFailureReason): SignInResult {
  return { ok: false, reason };
}

export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const config = getCognitoConfig();
  if (!config) {
    console.error("Cognito sign-in unavailable: configuration is incomplete.");
    return failure("service_unavailable");
  }

  const authParameters: Record<string, string> = {
    USERNAME: email,
    PASSWORD: password,
  };
  if (config.clientSecret) {
    authParameters.SECRET_HASH = computeSecretHash(
      email,
      config.clientId,
      config.clientSecret
    );
  }

  try {
    const response = await getClient(config.region).send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: config.clientId,
        AuthParameters: authParameters,
      })
    );

    // Challenges (e.g. NEW_PASSWORD_REQUIRED, MFA) are outside Sprint 1 scope.
    if (response.ChallengeName) {
      return failure("account_action_required");
    }

    const idToken = response.AuthenticationResult?.IdToken;
    const expiresIn = response.AuthenticationResult?.ExpiresIn;

    if (
      typeof idToken !== "string" ||
      !idToken.trim() ||
      typeof expiresIn !== "number" ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      console.error("Cognito sign-in returned an incomplete AuthenticationResult.");
      return failure("service_unavailable");
    }

    return { ok: true, tokens: { idToken, expiresInSeconds: expiresIn } };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";

    if (INVALID_CREDENTIAL_ERRORS.has(name)) {
      return failure("invalid_credentials");
    }
    if (ACCOUNT_ACTION_ERRORS.has(name)) {
      return failure("account_action_required");
    }

    // Log only the error name: messages could echo request details.
    console.error(`Cognito sign-in failed: ${name}`);
    return failure("service_unavailable");
  }
}
