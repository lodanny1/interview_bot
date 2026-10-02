"use client";

import type { ReactNode } from "react";
import { getAccessState } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = getCurrentUser();
  const accessState = getAccessState(user);

  if (accessState === "unauthenticated") {
    return (
      <AccessMessage
        title="Please sign in"
        message="Your session is missing. Please sign in to continue."
      />
    );
  }

  if (accessState === "pending") {
    return (
      <AccessMessage
        title="Account pending approval"
        message="Your account must be approved before you can access Interview Bot."
      />
    );
  }

  if (accessState === "rejected") {
    return (
      <AccessMessage
        title="Access denied"
        message="This account is not approved to access Interview Bot."
      />
    );
  }

  return <>{children}</>;
}

function AccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      </section>
    </main>
  );
}