// The signed-in user's ID token for the interview insights route.
import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { isMockMode } from "@/lib/target-job/target-job-api";

export async function insightsSessionToken(): Promise<string | null> {
  if (isMockMode()) return "mock-token";
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}
