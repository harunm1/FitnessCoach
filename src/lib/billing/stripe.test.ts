import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createStripeGateway } from "./stripe";
const config = {
  secretKey: "sk_test_fixture",
  priceId: "price_fixture",
  webhookSecret: "whsec_fixture",
  baseURL: "http://localhost:3000",
};
function fixture() {
  const line = {
    pricing: { price_details: { price: "price_fixture" } },
    parent: {
      type: "subscription_item_details",
      subscription_item_details: { subscription: "sub_fixture" },
    },
    quantity: 1,
    amount: 1000,
    period: { end: 2000000000 },
  };
  const invoice = {
    id: "in_fixture",
    livemode: false,
    status: "paid",
    customer: "cus_fixture",
    lines: { data: [line], has_more: false },
  };
  const sub = {
    id: "sub_fixture",
    customer: "cus_fixture",
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    pause_collection: null as null | { behavior: "void" },
    latest_invoice: invoice,
    items: {
      has_more: false,
      data: [
        {
          price: { id: "price_fixture" },
          quantity: 1,
          current_period_end: 1999999999,
        },
      ],
    },
  };
  const sdk = {
    subscriptions: {
      list: vi.fn(() =>
        (async function* () {
          yield sub;
        })(),
      ),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue(invoice),
      listLineItems: vi.fn(() =>
        (async function* () {
          yield line;
        })(),
      ),
    },
    prices: {
      retrieve: vi.fn().mockResolvedValue({
        id: "price_fixture",
        active: true,
        livemode: false,
        type: "recurring",
        billing_scheme: "per_unit",
        unit_amount: 1000,
        currency: "cad",
        recurring: {
          interval: "month",
          interval_count: 1,
          usage_type: "licensed",
        },
      }),
    },
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_fixture", livemode: false }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_fixture",
          livemode: false,
          status: "open",
          url: "https://checkout.stripe.com/c/test",
        }),
        retrieve: vi.fn(),
        expire: vi.fn().mockResolvedValue({ livemode: false }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ url: "https://billing.stripe.com/p/test" }),
      },
    },
  };
  return {
    sdk,
    sub,
    invoice,
    line,
    gateway: createStripeGateway(config, sdk as unknown as Stripe),
  };
}
describe("Stripe API gateway", () => {
  it("reads the current Stripe invoice parent and bounds paid access by both periods", async () => {
    const f = fixture();
    expect(f.line).not.toHaveProperty("subscription");
    expect((await f.gateway.subscriptions("cus_fixture"))[0].paidUntil).toEqual(
      new Date(1999999999 * 1000),
    );
    f.line.period.end = 1900000000;
    expect((await f.gateway.subscriptions("cus_fixture"))[0].paidUntil).toEqual(
      new Date(1900000000 * 1000),
    );
  });
  it.each(["open", "void", "uncollectible"])(
    "does not grant an active subscription with an %s invoice",
    async (status) => {
      const f = fixture();
      f.invoice.status = status;
      expect(
        (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
      ).toBeNull();
    },
  );
  it("does not grant for another price/customer or quantity", async () => {
    const f = fixture();
    f.line.pricing.price_details.price = "price_other";
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
    f.line.pricing.price_details.price = "price_fixture";
    f.invoice.customer = "cus_other";
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
    f.invoice.customer = "cus_fixture";
    f.sub.items.data[0].quantity = 2;
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
  });
  it("does not grant when collection is paused or invoice lines are unrelated", async () => {
    const f = fixture();
    f.sub.pause_collection = { behavior: "void" };
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
    f.sub.pause_collection = null;
    f.line.parent.subscription_item_details.subscription = "sub_other";
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
  });
  it("rejects invoice-item lines even when their price matches", async () => {
    const f = fixture();
    f.line.parent.type = "invoice_item_details";
    expect(
      (await f.gateway.subscriptions("cus_fixture"))[0].paidUntil,
    ).toBeNull();
  });
  it("retrieves paginated invoice lines", async () => {
    const f = fixture();
    f.invoice.lines.has_more = true;
    await f.gateway.subscriptions("cus_fixture");
    expect(f.sdk.invoices.listLineItems).toHaveBeenCalledWith("in_fixture", {
      limit: 100,
    });
  });
  it("rejects live or mismatched subscription data", async () => {
    const f = fixture();
    f.sub.livemode = true;
    await expect(f.gateway.subscriptions("cus_fixture")).rejects.toThrow();
    f.sub.livemode = false;
    f.sub.customer = "cus_other";
    await expect(f.gateway.subscriptions("cus_fixture")).rejects.toThrow();
  });
  it("uses only server configuration for checkout with a stable idempotency key and no Stripe trial", async () => {
    const f = fixture();
    await f.gateway.checkout("cus_fixture", "user_fixture", 2);
    expect(f.sdk.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_fixture",
        client_reference_id: "user_fixture",
        mode: "subscription",
        allowed_payment_method_types: ["card"],
        line_items: [{ price: "price_fixture", quantity: 1 }],
        success_url: "http://localhost:3000/account?billing=success",
        cancel_url: "http://localhost:3000/account?billing=cancelled",
        subscription_data: { metadata: { fitnesscoachUserId: "user_fixture" } },
      }),
      { idempotencyKey: "fitnesscoach-checkout-user_fixture-2-price_fixture" },
    );
  });
  it("caches only the price and fixes the portal return URL", async () => {
    const f = fixture();
    await f.gateway.price();
    await f.gateway.price();
    expect(f.sdk.prices.retrieve).toHaveBeenCalledOnce();
    await f.gateway.portal("cus_fixture");
    expect(f.sdk.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_fixture",
      return_url: "http://localhost:3000/account?billing=returned",
    });
  });
});

it("retrieves the actual price of an existing session and can expire it", async () => {
  const f = fixture();
  f.sdk.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_fixture",
    livemode: false,
    status: "open",
    url: "https://checkout.stripe.com/c/test",
    line_items: { has_more: false, data: [{ price: { id: "price_fixture" } }] },
  });
  expect((await f.gateway.retrieveCheckout("cs_fixture")).priceId).toBe(
    "price_fixture",
  );
  await f.gateway.expireCheckout("cs_fixture");
  expect(f.sdk.checkout.sessions.expire).toHaveBeenCalledWith("cs_fixture");
});

it("does not query an arbitrary price outside the configured allowlist", async () => {
  const f = fixture();
  await expect(f.gateway.price("price_forged")).rejects.toThrow(
    "Unknown subscription plan",
  );
  expect(f.sdk.prices.retrieve).not.toHaveBeenCalled();
});
it("validates named yearly prices against Stripe's actual recurring interval", async () => {
  const f = fixture();
  const gateway = createStripeGateway(
    { ...config, yearlyPriceId: "price_year" },
    f.sdk as unknown as Stripe,
  );
  f.sdk.prices.retrieve.mockResolvedValueOnce({
    id: "price_year",
    active: true,
    livemode: false,
    type: "recurring",
    billing_scheme: "per_unit",
    unit_amount: 10000,
    currency: "cad",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  });
  await expect(gateway.price("price_year")).rejects.toThrow(
    "configured interval",
  );
});
