import { describe, expect, it } from "vitest";

import { resolveInviteOrigin } from "@/lib/invite-url";

describe("resolveInviteOrigin", () => {
  it("prefers x-forwarded host and proto", () => {
    const request = new Request("http://localhost:3000/api/auth/invite", {
      headers: {
        "x-forwarded-host": "app.example.com, proxy.local",
        "x-forwarded-proto": "https, http",
        host: "localhost:3000",
      },
    });

    expect(resolveInviteOrigin(request, "http://localhost:3000")).toBe("https://app.example.com");
  });

  it("falls back to host header when x-forwarded host is missing", () => {
    const request = new Request("https://internal-host/api/auth/invite", {
      headers: {
        host: "app.example.com",
      },
    });

    expect(resolveInviteOrigin(request, "http://localhost:3000")).toBe("https://app.example.com");
  });

  it("falls back to env URL when forwarded/host headers are unavailable", () => {
    const request = new Request("http://localhost:3000/api/auth/invite");

    expect(resolveInviteOrigin(request, "https://prod.example.com/some/path")).toBe(
      "https://prod.example.com",
    );
  });

  it("falls back to localhost when request and env URL are invalid", () => {
    const invalidRequest = {
      url: "not-a-valid-url",
      headers: new Headers(),
    } as unknown as Request;

    expect(resolveInviteOrigin(invalidRequest, "also-not-a-valid-url")).toBe("http://localhost:3000");
  });
});
