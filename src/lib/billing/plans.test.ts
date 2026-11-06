import { describe, expect, it, vi } from "vitest";
import { configuredPriceIds } from "./config";
import { checkoutPrice, loadBillingPlans } from "./plans";
import type { BillingGateway, PlanPrice } from "./types";
const config = {
  secretKey: "sk_test_fixture",
  webhookSecret: "whsec_fixture",
  baseURL: "http://localhost:3000",
  priceId: "price_old",
  monthlyPriceId: "price_month",
  yearlyPriceId: "price_year",
};
const month: PlanPrice = {
  id: "price_month",
  amount: 1000,
  currency: "cad",
  interval: "month",
  intervalCount: 1,
};
const year: PlanPrice = {
  ...month,
  id: "price_year",
  amount: 10000,
  interval: "year",
};
function fixture() {
  const price = vi.fn(async (id: string) =>
    id === "price_year" ? year : { ...month, id },
  );
  return { price, gateway: { price } as unknown as BillingGateway };
}
describe("server billing option selection", () => {
  it("offers named options and keeps the legacy price allowlisted for existing subscriptions", async () => {
    const f = fixture();
    expect(configuredPriceIds(config)).toEqual([
      "price_month",
      "price_year",
      "price_old",
    ]);
    expect(await loadBillingPlans(config, f.gateway)).toEqual([month, year]);
    expect(await checkoutPrice(config, f.gateway, "year")).toBe("price_year");
  });
  it("rejects arbitrary price IDs and invalid interval types before API requests", async () => {
    const f = fixture();
    for (const value of ["price_year", "week", {}, null, ["month"]])
      await expect(checkoutPrice(config, f.gateway, value)).rejects.toThrow(
        "Choose monthly or yearly",
      );
    expect(f.price).not.toHaveBeenCalled();
  });
  it("leaves a healthy option available when the other lookup fails", async () => {
    const f = fixture();
    f.price.mockImplementation(async (id) => {
      if (id === "price_month") throw new Error("archived");
      return id === "price_year" ? year : { ...month, id };
    });
    expect(await loadBillingPlans(config, f.gateway)).toEqual([year]);
    await expect(checkoutPrice(config, f.gateway, "month")).rejects.toThrow(
      "unavailable",
    );
  });
  it("supports legacy single-price checkout without inventing a yearly option", async () => {
    const f = fixture();
    const legacy = {
      ...config,
      monthlyPriceId: undefined,
      yearlyPriceId: undefined,
    };
    expect(await checkoutPrice(legacy, f.gateway)).toBe("price_old");
    await expect(checkoutPrice(legacy, f.gateway, "year")).rejects.toThrow(
      "unavailable",
    );
  });
});
