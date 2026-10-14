// Server-only Cognito settings, read from environment variables.
// Values must never be hardcoded or exposed with a NEXT_PUBLIC_ prefix.
import "server-only";

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret?: string;
}

export function getCognitoConfig(): CognitoConfig | null {
  const region = process.env.COGNITO_REGION?.trim();
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();

  if (!region || !userPoolId || !clientId) {
    return null;
  }

  return clientSecret
    ? { region, userPoolId, clientId, clientSecret }
    : { region, userPoolId, clientId };
}
