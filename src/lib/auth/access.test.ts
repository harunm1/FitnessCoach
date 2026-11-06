import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, findUnique, redirect } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
import {
  AccessDeniedError,
  requireAccount,
  requirePageAccess,
  requirePermission,
} from "./access";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({
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
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
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
});
