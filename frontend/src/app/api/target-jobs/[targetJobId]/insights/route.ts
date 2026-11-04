import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

export async function GET(_request: Request, context: { params: Promise<{ targetJobId: string }> }) {
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!idToken) return NextResponse.json({ status: "error", code: "unauthenticated", error: "Sign in required" }, { status: 401 });
  const base = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!base) return NextResponse.json({ status: "error", code: "service_unavailable", error: "Backend unavailable" }, { status: 503 });
  const { targetJobId } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(targetJobId)) return NextResponse.json({ error: "Invalid target job id" }, { status: 400 });
  try {
    const response = await fetch(`${base}/me/target-jobs/${encodeURIComponent(targetJobId)}/insights`, {
      headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store",
    });
    return NextResponse.json(await response.json().catch(() => ({})), { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET target-job insights failed:", error);
    return NextResponse.json({ status: "error", code: "service_unavailable", error: "Backend unavailable" }, { status: 503 });
  }
}
