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
import { getVerifiedUser, requireUser } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
});
describe("protected-page authorization", () => {
  it("returns null without redirecting signed-out route callers", async () => {
    getSession.mockResolvedValue(null);
    expect(await getVerifiedUser()).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("does not return unverified users to route callers", async () => {
    getSession.mockResolvedValue({ user: { emailVerified: false } });
    expect(await getVerifiedUser()).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("redirects signed-out visitors before returning account information", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/sign-in");
  });
  it("rejects an unverified user even if a session is present", async () => {
    getSession.mockResolvedValue({ user: { emailVerified: false } });
    await expect(requireUser()).rejects.toThrow("redirect:/sign-in");
  });
  it("returns identity and tier fields after a fresh server check", async () => {
    const trialEndsAt = new Date("2026-11-20T12:00:00Z");
    getSession.mockResolvedValue({
      user: {
        id: "athlete",
        name: "Athlete",
        email: "athlete@example.test",
        emailVerified: true,
        tier: "TRIAL",
        trialEndsAt,
        password: "hidden",
      },
      session: { token: "hidden-token" },
    });
    expect(await requireUser()).toEqual({
      id: "athlete",
      name: "Athlete",
      email: "athlete@example.test",
      tier: "TRIAL",
      trialEndsAt,
    });
    expect(getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } }),
    );
  });
  it("does not retain tier data between requests", async () => {
    const user = {
      id: "athlete",
      name: "Athlete",
      email: "athlete@example.test",
      emailVerified: true,
    };
    getSession.mockResolvedValueOnce({ user: { ...user, tier: "FREE" } });
    getSession.mockResolvedValueOnce({
      user: { ...user, tier: "ADMIN", trialEndsAt: null },
    });
    expect(await requireUser()).toMatchObject({
      tier: "FREE",
      trialEndsAt: null,
    });
    expect(await requireUser()).toMatchObject({
      tier: "ADMIN",
      trialEndsAt: null,
    });
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
