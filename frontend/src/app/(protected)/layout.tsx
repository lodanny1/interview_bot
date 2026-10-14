import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session-cookie";
import { Sidebar } from "@/components/layout/Sidebar";

type MeResponse = {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    account_status: string;
    access_tier: string;
  };
};

async function getCurrentUser(): Promise<MeResponse["user"]> {
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

  const data = (await response.json()) as MeResponse;

  return data.user;
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

  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />

      <main className="flex-1 bg-white">
        {children}
      </main>
    </div>
  );
}