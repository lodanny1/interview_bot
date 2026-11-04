import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

async function token() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

function backendUrl() {
  return process.env.BACKEND_URL?.replace(/\/$/, "");
}

export async function GET() {
  const idToken = await token();
  const base = backendUrl();

  if (!idToken) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!base) {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${base}/me/target-jobs`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    return NextResponse.json(body, {
      status: response.status,
    });
  } catch (error) {
    console.error("GET /api/target-jobs failed:", error);

    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const idToken = await token();
  const base = backendUrl();

  if (!idToken) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!base) {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }

  const body = await request.json();

  try {
    const response = await fetch(`${base}/me/target-jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (error) {
    console.error("POST /api/target-jobs failed:", error);

    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(request: Request) {
  const idToken = await token();
  const base = backendUrl();

  if (!idToken) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!base) {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Target job id is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${base}/me/target-jobs/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: "no-store",
      }
    );

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const result = await response.json().catch(() => ({}));

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (error) {
    console.error("DELETE /api/target-jobs failed:", error);

    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 503 }
    );
  }
}
