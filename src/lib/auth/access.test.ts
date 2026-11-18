import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVerifiedUser, findUnique, redirect } = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./session", () => ({ getVerifiedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
import {
  AccessDeniedError,
  requireAccount,
  requirePageAccess,
  requirePermission,
  requireTier,
} from "./access";
import { COACH_TIERS, PLAN_TIERS } from "./tier";

beforeEach(() => {
  vi.clearAllMocks();
  getVerifiedUser.mockResolvedValue({
    id: "session-user",
    name: "Athlete",
    email: "athlete@example.test",
    tier: "ADMIN",
  });
  findUnique.mockResolvedValue({
    tier: "FREE",
    trialEndsAt: null,
    emailVerified: true,
  });
});

describe("server access guards", () => {
  it("requires authentication before querying account permissions", async () => {
    getVerifiedUser.mockResolvedValue(null);
    await expect(requirePermission("coach")).rejects.toThrow(
      "redirect:/sign-in",
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("uses the database tier and session owner instead of a stale session tier", async () => {
    await expect(requirePermission("manage-content")).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "session-user" });
  });

  it("rechecks permissions after a tier changes without requiring a new login", async () => {
    findUnique.mockResolvedValueOnce({
      tier: "PRO",
      billing: { status: "active", paidUntil: new Date(Date.now() + 86400000) },
      trialEndsAt: null,
      emailVerified: true,
    });
    expect((await requirePermission("coach")).user.id).toBe("session-user");
    await expect(requirePermission("coach")).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it.each([null, { tier: "ADMIN", trialEndsAt: null, emailVerified: false }])(
    "denies missing or unverified database accounts",
    async (account) => {
      findUnique.mockResolvedValue(account);
      await expect(requireAccount()).rejects.toThrow("redirect:/sign-in");
    },
  );

  it("allows FREE features and redirects blocked pages to account access", async () => {
    await expect(requirePermission("default-plan")).resolves.toBeDefined();
    await expect(requirePageAccess("coach")).rejects.toThrow(
      "redirect:/account?access=required",
    );
  });

  it("does not turn database outages into permission redirects", async () => {
    findUnique.mockRejectedValue(new Error("database unavailable"));
    await expect(requirePageAccess("coach")).rejects.toThrow(
      "database unavailable",
    );
  });

  it("returns 401 without redirecting a signed-out API or action caller", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect(await requireTier(COACH_TIERS)).toMatchObject({
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns 403 for FREE chat access without throwing or redirecting", async () => {
    expect(await requireTier(COACH_TIERS)).toMatchObject({
      ok: false,
      status: 403,
      code: "FORBIDDEN",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(PLAN_TIERS)(
    "allows a verified %s account to request a plan",
    async (tier) => {
      findUnique.mockResolvedValue({
        tier,
        billing: {
          status: "active",
          paidUntil: new Date(Date.now() + 86400000),
        },
        emailVerified: true,
        trialEndsAt: new Date(Date.now() + 60_000),
      });
      expect(await requireTier(PLAN_TIERS)).toMatchObject({
        ok: true,
        user: { id: "session-user" },
        access: { effectiveTier: tier },
      });
    },
  );

  it("denies expired trials for chat but still permits plan requests", async () => {
    const now = new Date("2026-11-06T12:00:00Z");
    findUnique.mockResolvedValue({
      tier: "TRIAL",
      trialEndsAt: now,
      emailVerified: true,
    });
    expect(await requireTier(COACH_TIERS, now)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await requireTier(PLAN_TIERS, now)).toMatchObject({
      ok: true,
      access: { effectiveTier: "FREE" },
    });
  });

  it("uses current database permissions instead of a session's old tier", async () => {
    findUnique.mockResolvedValueOnce({
      tier: "PRO",
      billing: { status: "active", paidUntil: new Date(Date.now() + 86400000) },
      trialEndsAt: null,
      emailVerified: true,
    });
    expect(await requireTier(COACH_TIERS)).toMatchObject({ ok: true });
    expect(await requireTier(COACH_TIERS)).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("checks expiry after the account lookup rather than before its wait", async () => {
    const expiresAt = new Date("2026-11-06T12:00:00Z");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(expiresAt.getTime() - 1);
      findUnique.mockImplementationOnce(async () => {
        vi.setSystemTime(expiresAt);
        return { tier: "TRIAL", trialEndsAt: expiresAt, emailVerified: true };
      });
      expect(await requireTier(COACH_TIERS)).toMatchObject({
        ok: false,
        status: 403,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([null, { tier: "PRO", trialEndsAt: null, emailVerified: false }])(
    "rejects removed or no-longer-verified accounts",
    async (account) => {
      findUnique.mockResolvedValue(account);
      expect(await requireTier(PLAN_TIERS)).toMatchObject({
        ok: false,
        status: 401,
      });
    },
  );

  it("never grants access when the account database cannot be read", async () => {
    findUnique.mockRejectedValue(new Error("database unavailable"));
    await expect(requireTier(PLAN_TIERS)).rejects.toThrow(
      "database unavailable",
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
