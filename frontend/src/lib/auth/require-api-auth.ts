import "server-only";

import { verifyAccessToken } from "./verify-access-token";

export interface AuthenticatedApiUser {
  sub: string;
  clientId: string;
  scope?: string;
}

export async function requireApiAuth(
  authorizationHeader: string | null
): Promise<AuthenticatedApiUser | null> {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader);

  if (!match) {
    return null;
  }

  return verifyAccessToken(match[1]);
}