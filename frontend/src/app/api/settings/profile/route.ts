import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const useMockData = process.env.USE_MOCK_DATA === "true";

export async function PATCH(request: Request) {
  const body = await request.json();

  if (useMockData) {
    return NextResponse.json(
      {
        success: true,
        profile: {
          fullName: body.fullName,
          role: body.role,
        },
      },
      { status: 200 }
    );
  }

  const cookieStore = await cookies();
  const idToken = cookieStore.get("ib_session")?.value;

  if (!idToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured" },
      { status: 500 }
    );
  }

  const response = await fetch(
    `${backendUrl}/me/profile`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}
