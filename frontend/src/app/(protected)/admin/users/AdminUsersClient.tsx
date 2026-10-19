"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  account_status: string;
  access_tier: string;
  created_at: string;
};

type Props = {
  users: AdminUser[];
  currentAdminId: string;
};

export default function AdminUsersClient({
  users,
  currentAdminId,
}: Props) {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(
    null
  );

  async function updateStatus(user: AdminUser) {
    if (user.id === currentAdminId) {
      return;
    }

    const nextStatus =
      user.account_status === "ACTIVE"
        ? "DISABLED"
        : "ACTIVE";

    setLoadingUserId(user.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update account status");
      }

      setMessage(
        nextStatus === "ACTIVE"
          ? "User account reactivated."
          : "User account disabled."
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Unable to update account status.");
    } finally {
      setLoadingUserId(null);
    }
  }

  async function updateTier(
    userId: string,
    tier: string
  ) {
    setLoadingUserId(userId);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/users/${userId}/tier`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tier,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update access tier");
      }

      setMessage("User access tier updated.");

      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Unable to update access tier.");
    } finally {
      setLoadingUserId(null);
    }
  }

  return (
    <>
      {message && (
        <div className="mb-6 rounded-lg border border-line-subtle bg-card px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      <section className="bg-card rounded-2xl border border-line-subtle shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-line-subtle">
          <h2 className="text-xl font-medium text-primary">
            Users
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-line-subtle bg-hover/30">
              <tr>
                <TableHeading>Name</TableHeading>
                <TableHeading>Email</TableHeading>
                <TableHeading>Role</TableHeading>
                <TableHeading>Tier</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Created</TableHeading>
                <TableHeading>Actions</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-line-subtle">
              {users.map((user) => {
                const isCurrentAdmin =
                  user.id === currentAdminId;

                const loading =
                  loadingUserId === user.id;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-hover/30 transition-colors"
                  >
                    <TableCell>
                      {user.display_name || "—"}
                    </TableCell>

                    <TableCell>
                      {user.email}
                    </TableCell>

                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>

                    <TableCell>
                      <select
                        value={user.access_tier}
                        disabled={loading}
                        onChange={(event) =>
                          updateTier(
                            user.id,
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-primary disabled:opacity-50"
                      >
                        <option value="BASIC">
                          BASIC
                        </option>
                        <option value="PREMIUM">
                          PREMIUM
                        </option>
                      </select>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        status={user.account_status}
                      />
                    </TableCell>

                    <TableCell>
                      {new Date(
                        user.created_at
                      ).toLocaleDateString()}
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        disabled={
                          loading || isCurrentAdmin
                        }
                        onClick={() =>
                          updateStatus(user)
                        }
                        className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-primary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading
                          ? "Updating..."
                          : isCurrentAdmin
                          ? "Current Admin"
                          : user.account_status ===
                            "ACTIVE"
                          ? "Disable"
                          : "Reactivate"}
                      </button>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-tertiary">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="px-6 py-4 text-sm text-primary whitespace-nowrap">
      {children}
    </td>
  );
}

function RoleBadge({
  role,
}: {
  role: string;
}) {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full font-mono text-xs ${
        role === "ADMIN"
          ? "bg-tinted text-cta"
          : "bg-hover text-secondary"
      }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full font-mono text-xs ${
        status === "ACTIVE"
          ? "bg-success-bg text-success-text"
          : "bg-info-bg text-info-text"
      }`}
    >
      {status}
    </span>
  );
}