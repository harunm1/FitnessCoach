import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({ api: { getSession } }),
}));
import { requireUser } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
});
describe("protected-page authorization", () => {
  it("redirects signed-out visitors before returning account information", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/sign-in");
  });
  it("rejects an unverified user even if a session is present", async () => {
    getSession.mockResolvedValue({ user: { emailVerified: false } });
    await expect(requireUser()).rejects.toThrow("redirect:/sign-in");
  });
  it("returns only display fields after a fresh server check", async () => {
    getSession.mockResolvedValue({
      user: {
        id: "athlete",
        name: "Athlete",
        email: "athlete@example.test",
        emailVerified: true,
        password: "hidden",
      },
      session: { token: "hidden-token" },
    });
    expect(await requireUser()).toEqual({
      id: "athlete",
      name: "Athlete",
      email: "athlete@example.test",
    });
    expect(getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } }),
    );
  });
});
