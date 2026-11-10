import { beforeEach, expect, it, vi } from "vitest";
const {
  requireUser,
  getBillingRuntime,
  checkout,
  portal,
  refresh,
  revalidatePath,
  checkoutPrice,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getBillingRuntime: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
  checkoutPrice: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/billing/runtime", () => ({ getBillingRuntime }));
vi.mock("@/lib/billing/plans", () => ({ checkoutPrice }));
vi.mock("next/cache", () => ({ revalidatePath }));
import {
  startCheckout,
  openBillingPortal,
  refreshBilling,
} from "./billing-actions";
beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner" });
  getBillingRuntime.mockResolvedValue({
    service: { checkout, portal, refresh },
  });
  checkoutPrice.mockResolvedValue("price_monthly");
  checkout.mockResolvedValue("https://checkout.stripe.com/test");
  portal.mockResolvedValue("https://billing.stripe.com/test");
  refresh.mockResolvedValue({ paid: true });
});
it("requires a verified session before initializing Stripe", async () => {
  requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
  await expect(startCheckout()).rejects.toThrow("redirect:/sign-in");
  expect(getBillingRuntime).not.toHaveBeenCalled();
});
it("uses only the session owner for checkout and portal", async () => {
  expect((await startCheckout()).url).toBe("https://checkout.stripe.com/test");
  await openBillingPortal();
  expect(checkout).toHaveBeenCalledWith("session-owner", "price_monthly");
  expect(portal).toHaveBeenCalledWith("session-owner");
});
it("reconciles before revalidating access", async () => {
  const result = await refreshBilling();
  expect(result.paid).toBe(true);
  expect(result.message).toContain("PRO access is ready");
  expect(refresh).toHaveBeenCalledWith("session-owner");
  expect(revalidatePath).toHaveBeenCalledWith("/account");
});
it("does not leak gateway errors or secrets", async () => {
  checkout.mockRejectedValue(new Error("sk_test_private_exception"));
  expect((await startCheckout()).error).not.toContain("sk_test_private");
});

it("reports an unconfirmed payment without claiming PRO", async () => {
  refresh.mockResolvedValueOnce({ paid: false });
  expect((await refreshBilling()).paid).toBe(false);
});

it("passes the selected interval through server allowlisting", async () => {
  checkoutPrice.mockResolvedValueOnce("price_yearly");
  await startCheckout("year");
  expect(checkoutPrice).toHaveBeenCalledWith(undefined, undefined, "year");
  expect(checkout).toHaveBeenCalledWith("session-owner", "price_yearly");
});
