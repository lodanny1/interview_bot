import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/auth/session-cookie";
import {
  LOGOUT_ERROR_MESSAGE,
  POST_LOGOUT_REDIRECT,
} from "@/lib/auth/logout-form-state";
import { logoutAction } from "@/app/logout/actions";

vi.mock("@/lib/auth/session-cookie", () => ({ deleteSession: vi.fn() }));
// The real redirect() throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("logoutAction", () => {
  beforeEach(() => {
    vi.mocked(deleteSession).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("deletes the session, then redirects to the login page", async () => {
    vi.mocked(deleteSession).mockResolvedValue();

    await expect(logoutAction()).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(POST_LOGOUT_REDIRECT);
    expect(POST_LOGOUT_REDIRECT).toBe("/login");
    expect(vi.mocked(deleteSession).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(redirect).mock.invocationCallOrder[0]
    );
  });

  it("shows an error and does not redirect when logout fails", async () => {
    vi.mocked(deleteSession).mockRejectedValue(new Error("cookie store down"));

    await expect(logoutAction()).resolves.toEqual({
      formError: LOGOUT_ERROR_MESSAGE,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
