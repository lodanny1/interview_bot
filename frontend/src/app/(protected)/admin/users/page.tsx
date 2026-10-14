import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminUsersClient, {
  type AdminUser,
} from "./AdminUsersClient";

type AdminUsersResponse = {
  users: AdminUser[];
};

type MeResponse = {
  user: {
    id: string;
    role: string;
  };
};

async function getIdToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ib_session")?.value ?? null;
}

async function getCurrentUser(idToken: string) {
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

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load current user: ${response.status}`
    );
  }

  return (await response.json()) as MeResponse;
}

async function getAdminUsers(idToken: string) {
  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  const response = await fetch(`${backendUrl}/admin/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (response.status === 403) {
    redirect("/dashboard");
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load admin users: ${response.status}`
    );
  }

  return (await response.json()) as AdminUsersResponse;
}

export default async function AdminUsersPage() {
  const idToken = await getIdToken();

  if (!idToken) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser(idToken);

  if (currentUser.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { users } = await getAdminUsers(idToken);

  const activeUsers = users.filter(
    (user) => user.account_status === "ACTIVE"
  ).length;

  const premiumUsers = users.filter(
    (user) => user.access_tier === "PREMIUM"
  ).length;

  const adminUsers = users.filter(
    (user) => user.role === "ADMIN"
  ).length;

  return (
    <main className="p-10 w-full">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          User Administration
        </h1>

        <p className="mt-2 text-tertiary">
          Manage Interview Bot users, account status, and access tiers.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Users"
          value={users.length}
        />

        <StatCard
          label="Active Users"
          value={activeUsers}
        />

        <StatCard
          label="Premium Users"
          value={premiumUsers}
        />

        <StatCard
          label="Administrators"
          value={adminUsers}
        />
      </div>

      <AdminUsersClient
        users={users}
        currentAdminId={currentUser.user.id}
      />
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="p-5 bg-card rounded-2xl border border-line-subtle shadow-sm">
      <p className="text-sm text-tertiary">
        {label}
      </p>

      <p className="mt-2 text-3xl font-semibold text-primary">
        {value}
      </p>
    </div>
  );
}