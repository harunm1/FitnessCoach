import { describe, expect, it } from "vitest";
import { readBillingConfig } from "./config";
import { priceLabel, stripeURL, validatePrice } from "./stripe";
import type Stripe from "stripe";
const env = {
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  BETTER_AUTH_URL: "http://localhost:3000",
};
describe("test-only billing configuration", () => {
  it("accepts local test settings", () =>
    expect(readBillingConfig(env).baseURL).toBe(env.BETTER_AUTH_URL));
  it.each([
    { STRIPE_SECRET_KEY: "sk_live_no" },
    { STRIPE_PRICE_ID: "" },
    { STRIPE_WEBHOOK_SECRET: "" },
    { BETTER_AUTH_URL: "http://example.com" },
    { BETTER_AUTH_URL: "https://example.com/path" },
    { BETTER_AUTH_URL: "https://x:y@example.com" },
  ])("rejects incomplete or unsafe settings %j", (overrides) =>
    expect(() => readBillingConfig({ ...env, ...overrides })).toThrow(),
  );
  it("does not require Stripe settings to import the module", () =>
    expect(() => readBillingConfig({})).toThrow(
      "Subscriptions are unavailable",
    ));
  it.each([
    "http://checkout.stripe.com/x",
    "https://checkout.stripe.com.evil.test/x",
    "https://evil.test/x",
    "https://x@checkout.stripe.com/x",
  ])("rejects an untrusted link %s", (url) =>
    expect(() => stripeURL(url, "checkout.stripe.com")).toThrow(),
  );
  it("validates a licensed recurring price and uses its actual currency", () => {
    const price = {
      id: "price_fixture",
      active: true,
      livemode: false,
      type: "recurring",
      billing_scheme: "per_unit",
      unit_amount: 1500,
      currency: "cad",
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "licensed",
      },
    } as Stripe.Price;
    expect(priceLabel(validatePrice(price))).toContain("15.00 CAD / month");
    for (const override of [
      { livemode: true },
      { active: false },
      { unit_amount: 0 },
      { recurring: null },
      { billing_scheme: "tiered" },
    ])
      expect(() =>
        validatePrice({ ...price, ...override } as Stripe.Price),
      ).toThrow();
  });
});

it("accepts explicit monthly/yearly IDs without a legacy setting and preserves legacy IDs", () => {
  const config = readBillingConfig({
    ...env,
    STRIPE_PRICE_ID: "",
    STRIPE_MONTHLY_PRICE_ID: "price_month",
    STRIPE_YEARLY_PRICE_ID: "price_year",
  });
  expect(config).toMatchObject({
    priceId: "price_month",
    monthlyPriceId: "price_month",
    yearlyPriceId: "price_year",
  });
  expect(() =>
    readBillingConfig({
      ...env,
      STRIPE_MONTHLY_PRICE_ID: "price_same",
      STRIPE_YEARLY_PRICE_ID: "price_same",
    }),
  ).toThrow();
  expect(() =>
    readBillingConfig({ ...env, STRIPE_YEARLY_PRICE_ID: "prod_wrong" }),
  ).toThrow();
});
