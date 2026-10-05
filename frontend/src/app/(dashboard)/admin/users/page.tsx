"use client";

import { useState } from "react";
import { canManageUsers } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { mockUsers } from "@/lib/auth/mock-users";
import type { AppUser, UserTier } from "@/lib/auth/types";

const tierOptions: UserTier[] = ["free", "standard", "premium"];

export default function AdminUsersPage() {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<AppUser[]>(Object.values(mockUsers));
  const [message, setMessage] = useState("");

  if (!canManageUsers(currentUser)) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Admin access required
        </h1>
        <p className="mt-2 text-gray-600">
          Only approved administrators can manage user accounts.
        </p>
      </main>
    );
  }

  function updateUser(
    userId: string,
    changes: Partial<Pick<AppUser, "status" | "tier">>
  ) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? { ...user, ...changes } : user
      )
    );

    setMessage("User access was updated.");
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        User Approval and Access Tiers
      </h1>
      <p className="mt-2 text-gray-600">
        Review accounts and manage their application access.
      </p>

      {message && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {users.map((user) => (
          <section
            key={user.id}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-medium text-gray-900">{user.name}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="mt-1 text-sm text-gray-600">
                  Status: {user.status} · Tier: {user.tier} · Role: {user.role}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={user.tier}
                  onChange={(event) =>
                    updateUser(user.id, {
                      tier: event.target.value as UserTier,
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  aria-label={`Access tier for ${user.name}`}
                >
                  {tierOptions.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>

                {user.status === "pending" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateUser(user.id, { status: "approved" })
                    }
                    className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Approve
                  </button>
                )}

                {user.status === "approved" && user.role !== "admin" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateUser(user.id, { status: "rejected" })
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Restrict
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}