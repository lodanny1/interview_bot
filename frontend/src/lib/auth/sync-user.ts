import "server-only";

export interface ApplicationUser {
  id: string;
  email: string;
  display_name: string | null;
  approval_status: string;
  access_tier: string;
  cognito_sub: string;
  created_at: string;
}

export async function syncAuthenticatedUser(
  idToken: string,
  targetRole?: string
): Promise<ApplicationUser> {
  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  const response = await fetch(`${backendUrl}/auth/sync-user`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      targetRole,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`User sync failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    user?: ApplicationUser;
  };

  if (!data.user) {
    throw new Error("Backend did not return an application user.");
  }

  return data.user;
}