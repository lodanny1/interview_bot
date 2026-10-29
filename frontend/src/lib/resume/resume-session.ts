// The signed-in user's ID token for the resume API routes.
import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { isMockMode } from "./resume-api";

export async function resumeSessionToken(): Promise<string | null> {
  if (isMockMode()) return "mock-token";
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}
