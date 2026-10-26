import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session-cookie";
import { Sidebar } from "@/components/layout/Sidebar";
import { SETUP_PATH } from "@/lib/setup/setup-form-state";

type MeResponse = {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    account_status: string;
    access_tier: string;
  };
  // undefined when the backend is older than Complete User Setup (#05).
  setupCompleted?: boolean;
};

async function getCurrentUser(): Promise<MeResponse> {
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
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  const { user, setupCompleted } = await getCurrentUser();

  // Users must finish setup before using the app (#05). Only redirect on an
  // explicit false so an older backend without the flag doesn't loop.
  if (setupCompleted === false) {
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