import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

export async function PUT(request: Request, context: { params: Promise<{ targetJobId: string }> }) {
  const idToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!idToken) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const base = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!base) return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  const { targetJobId } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(targetJobId)) return NextResponse.json({ error: "Invalid target job id" }, { status: 400 });
  try {
    const body = await request.json();
    const response = await fetch(`${base}/me/target-jobs/${encodeURIComponent(targetJobId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
    return NextResponse.json(await response.json().catch(() => ({})), { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("PUT target job failed:", error);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
