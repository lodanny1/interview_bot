import "server-only";

import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getCognitoConfig } from "./cognito-config";

export interface AccessTokenClaims {
  sub: string;
  clientId: string;
  scope?: string;
}

let cachedVerifier:
  | ReturnType<typeof CognitoJwtVerifier.create>
  | null = null;

let cachedConfigKey: string | null = null;

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenClaims | null> {
  const config = getCognitoConfig();

  if (!config || !token?.trim()) {
    return null;
  }

  try {
    const configKey = `${config.userPoolId}:${config.clientId}`;

    if (!cachedVerifier || cachedConfigKey !== configKey) {
      cachedVerifier = CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        clientId: config.clientId,
        tokenUse: "access",
      });

      cachedConfigKey = configKey;
    }

    const payload = await cachedVerifier.verify(token);

    if (typeof payload.sub !== "string") {
      return null;
    }

if (typeof payload.client_id !== "string") {
  return null;
}

return {
  sub: payload.sub,
  clientId: payload.client_id,
  ...(typeof payload.scope === "string"
    ? { scope: payload.scope }
    : {}),
};
  } catch {
    return null;
  }
}