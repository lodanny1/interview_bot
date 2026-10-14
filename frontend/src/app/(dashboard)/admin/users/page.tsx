
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session-cookie";

export default async function AdminUsersPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Admin access unavailable
      </h1>
      <p className="mt-2 text-gray-600">
        Administrator access will be available once account
        approval and role verification are connected.
      </p>
    </main>
  );
}
