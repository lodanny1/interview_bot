// Server-side session cookie. Stores the Cognito ID token in an httpOnly cookie
// and verifies it on every read. readSession() is the integration point for
// the shared getCurrentUser() in lib/auth/session.ts.
import "server-only";
import { cookies } from "next/headers";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { CognitoTokens } from "./cognito";
import { getCognitoConfig, type CognitoConfig } from "./cognito-config";

export interface SessionClaims {
  sub: string;
  email: string;
  name?: string;
}

export const SESSION_COOKIE_NAME = "ib_session";

function createIdTokenVerifier(config: CognitoConfig) {
  return CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    clientId: config.clientId,
    tokenUse: "id",
  });
}

let cachedVerifier: {
  key: string;
  verifier: ReturnType<typeof createIdTokenVerifier>;
} | null = null;

function getVerifier(config: CognitoConfig) {
  const key = `${config.userPoolId}:${config.clientId}`;
  if (cachedVerifier?.key !== key) {
    cachedVerifier = { key, verifier: createIdTokenVerifier(config) };
  }
  return cachedVerifier.verifier;
}

// Must be called from a Server Action or Route Handler (Next.js cookie rules).
export async function createSession(tokens: CognitoTokens): Promise<void> {
  const { idToken, expiresInSeconds } = tokens;

  if (
    typeof idToken !== "string" ||
    !idToken.trim() ||
    !Number.isFinite(expiresInSeconds) ||
    expiresInSeconds < 1
  ) {
    throw new Error("Cannot create a session from incomplete token data.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresInSeconds),
  });
}

// Returns verified identity claims, or null for a missing, invalid or expired
// session. Never throws.
export async function readSession(): Promise<SessionClaims | null> {
  const config = getCognitoConfig();
  if (!config) {
    return null;
  }

  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const payload = await getVerifier(config).verify(token);

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return typeof payload.name === "string"
      ? { sub: payload.sub, email: payload.email, name: payload.name }
      : { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
