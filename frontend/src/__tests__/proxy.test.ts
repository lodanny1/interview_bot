import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isPublicPath, proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

function request(path: string, withSession = false): NextRequest {
  const headers = withSession
    ? { cookie: `${SESSION_COOKIE_NAME}=id-token` }
    : undefined;
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy", () => {
  it("redirects visitors without a session to /login", () => {
    const response = proxy(request("/interviews"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("blocks the dashboard after logout removes the cookie", () => {
    const response = proxy(request("/"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("lets signed-in users through", () => {
    const response = proxy(request("/interviews", true));

    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/login", "/signup", "/landing"])(
    "keeps %s public",
    (path) => {
      expect(proxy(request(path)).headers.get("location")).toBeNull();
    }
  );

  it("does not treat look-alike paths as public", () => {
    expect(isPublicPath("/login-help")).toBe(false);
    expect(isPublicPath("/signup/confirm")).toBe(true);
  });
});
