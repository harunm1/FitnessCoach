// Exercise the actual requireTier policy at the HTTP boundary, not a mocked guard.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { session, account } = vi.hoisted(() => ({
  session: vi.fn(),
  account: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: session }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: account } } }));
import { POST } from "./route";

const now = new Date("2026-11-20T17:00:00Z");
const future = new Date(now.getTime() + 60_000);
function request() {
  return new Request("https://fitness.test/api/coach", {
    method: "POST",
    headers: {
      origin: "https://fitness.test",
      "content-type": "application/json",
    },
    // Blank text stops after admission, before profile/model work, when allowed.
    body: JSON.stringify({ message: "" }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  session.mockResolvedValue({ id: "verified-owner", tier: "ADMIN" });
});
afterEach(() => vi.useRealTimers());

describe("stream route fresh tier policy", () => {
  it.each([
    ["FREE", null, null, 403],
    ["TRIAL", future, null, 400],
    ["TRIAL", now, null, 403],
    ["PRO", null, { status: "active", paidUntil: future }, 400],
    ["PRO", null, { status: "active", paidUntil: now }, 403],
    ["PRO", null, { status: "past_due", paidUntil: future }, 403],
    ["PRO", null, null, 403],
    ["ADMIN", null, null, 400],
  ])(
    "rechecks %s entitlement before any stream is opened",
    async (tier, trialEndsAt, billing, status) => {
      account.mockResolvedValue({
        tier,
        trialEndsAt,
        billing,
        emailVerified: true,
      });
      const response = await POST(request());
      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(account).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "verified-owner" } }),
      );
    },
  );
  it("returns 401 when there is no verified session", async () => {
    session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(account).not.toHaveBeenCalled();
  });
  it.each([null, { tier: "ADMIN", emailVerified: false }])(
    "returns 401 for a removed or unverified database account",
    async (row) => {
      account.mockResolvedValue(row);
      expect((await POST(request())).status).toBe(401);
    },
  );
  it("rechecks expiry on a later request in the same session", async () => {
    account.mockResolvedValue({
      tier: "TRIAL",
      trialEndsAt: future,
      billing: null,
      emailVerified: true,
    });
    expect((await POST(request())).status).toBe(400);
    vi.setSystemTime(future);
    expect((await POST(request())).status).toBe(403);
  });
});
