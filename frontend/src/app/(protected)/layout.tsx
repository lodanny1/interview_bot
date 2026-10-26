import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session-cookie";
import { Sidebar } from "@/components/layout/Sidebar";
import { SETUP_PATH } from "@/lib/setup/setup-form-state";
import { mockMeResponse } from "@/mocks/mock-auth-user";

type MeResponse = {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    account_status: string;
    access_tier: string;
  };
  setupCompleted?: boolean;
};

const useMockData = process.env.USE_MOCK_DATA === "true";

async function getCurrentUser(): Promise<MeResponse> {
  if (useMockData) {
    return mockMeResponse;
  }

  const cookieStore = await cookies();
  const idToken = cookieStore.get("ib_session")?.value;

  if (!idToken) {
    redirect("/login");
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  const response = await fetch(`${backendUrl}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load authenticated user: ${response.status}`
    );
  }

  return (await response.json()) as MeResponse;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!useMockData) {
    const session = await readSession();

    if (!session) {
      redirect("/login");
    }
  }

  const { user, setupCompleted } = await getCurrentUser();

  if (!useMockData && setupCompleted === false) {
    redirect(SETUP_PATH);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />

      <main className="flex-1 bg-white">
        {children}
      </main>
    </div>
  );
}
