import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign In - Phyyve",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  // Set by the password reset flow after a successful reset.
  const { reset } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 bg-gray-300 rounded flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-gray-600" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
            <p className="text-sm text-gray-500">
              Welcome back to Interview Bot.
            </p>
          </div>
        </div>

        {reset === "success" && (
          <p
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            Password updated. Sign in with your new password.
          </p>
        )}

        <LoginForm action={loginAction} />

        <p className="text-center text-sm text-gray-500">
          <Link href="/forgot-password" className="font-medium text-gray-700 hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </main>
  );
}
