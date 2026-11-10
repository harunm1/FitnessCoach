import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { findUnique, retrieve } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { billingAccount: { findUnique } } }));
vi.mock("stripe", () => ({
  default: class Stripe {
    prices = { retrieve };
  },
}));
import { billingOverview } from "./runtime";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_runtime");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_runtime");
  vi.stubEnv("STRIPE_PRICE_ID", "price_runtime");
  vi.stubEnv("STRIPE_MONTHLY_PRICE_ID", "");
  vi.stubEnv("STRIPE_YEARLY_PRICE_ID", "");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  findUnique.mockResolvedValue({
    stripeCustomerId: "cus_fixture",
    status: "active",
    paidUntil: new Date("2030-01-01T00:00:00Z"),
    stripePriceId: "price_runtime",
    cancelAtPeriodEnd: true,
  });
  retrieve.mockRejectedValue(new Error("price unavailable"));
});
afterEach(() => vi.unstubAllEnvs());
it("preserves customer, paid status and expiry when upgrade pricing fails", async () => {
  expect(await billingOverview("owner")).toMatchObject({
    available: false,
    hasCustomer: true,
    status: "active",
    paidUntil: "2030-01-01T00:00:00.000Z",
    cancelAtPeriodEnd: true,
    plans: [],
  });
  expect(findUnique).toHaveBeenCalledWith({ where: { userId: "owner" } });
});
