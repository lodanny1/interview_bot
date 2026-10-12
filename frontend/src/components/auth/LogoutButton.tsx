"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/logout/actions";
import { INITIAL_LOGOUT_FORM_STATE } from "@/lib/auth/logout-form-state";

export function LogoutButton() {
  const [state, formAction, isPending] = useActionState(
    logoutAction,
    INITIAL_LOGOUT_FORM_STATE
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg text-base font-medium text-secondary hover:bg-hover transition-colors disabled:opacity-60"
      >
        <LogOut className="w-5 h-5" />
        {isPending ? "Logging out..." : "Log Out"}
      </button>
      {state.formError && (
        <p role="alert" className="px-4 pt-1 text-xs text-red-600">
          {state.formError}
        </p>
      )}
    </form>
  );
}
