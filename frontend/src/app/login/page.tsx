import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign In - Phyyve",
};

export default function LoginPage() {
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

        <LoginForm action={loginAction} />
      </div>
    </main>
  );
}
