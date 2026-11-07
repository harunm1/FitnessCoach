import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { BillingService } from "@/lib/billing/service";
import { resolveAccess } from "@/lib/auth/access-policy";
import type { BillingGateway, SubscriptionState } from "@/lib/billing/types";
import { testDatabase } from "../helpers/database";
const db = testDatabase();
const prefix = `billing-${randomUUID()}`;
let sequence = 0;
async function fixture(
  options: { trial?: Date; verified?: boolean; admin?: boolean } = {},
) {
  const user = await db.user.create({
    data: {
      name: "Billing Athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: options.verified ?? true,
      tier: options.admin ? "ADMIN" : options.trial ? "TRIAL" : "FREE",
      trialEndsAt: options.trial ?? null,
    },
  });
  let states: SubscriptionState[] = [];
  let sessionStatus = "open";
  let sessionPrice = "price_fixture";
  const gateway = {
    price: vi.fn().mockResolvedValue({
      id: "price_fixture",
      amount: 1000,
      currency: "cad",
      interval: "month",
      intervalCount: 1,
    }),
    customer: vi.fn().mockResolvedValue(`cus_${user.id}`),
    subscriptions: vi.fn(async () => states),
    checkout: vi.fn(
      async (
        _customer: string,
        _user: string,
        attempt: number,
        priceId = "price_fixture",
      ) => {
        sessionPrice = priceId;
        return {
          id: `cs_${user.id}_${attempt}`,
          status: "open",
          priceId,
          url: `https://checkout.stripe.com/c/${user.id}/${attempt}`,
        };
      },
    ),
    retrieveCheckout: vi.fn(async (id: string) => ({
      id,
      status: sessionStatus,
      priceId: sessionPrice,
      url: `https://checkout.stripe.com/c/${user.id}/1`,
    })),
    expireCheckout: vi.fn(async () => {
      sessionStatus = "expired";
    }),
    portal: vi.fn().mockResolvedValue("https://billing.stripe.com/p/session"),
  } satisfies BillingGateway;
  const service = new BillingService(db, gateway, [
    "price_fixture",
    "price_yearly",
  ]);
  return {
    user,
    service,
    gateway,
    states: (value: SubscriptionState[]) => {
      states = value;
    },
    session: (status: string) => {
      sessionStatus = status;
    },
    saved: () =>
      db.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { billing: true },
      }),
    event: (
      id: string = randomUUID(),
      type = "invoice.paid",
      customer = `cus_${user.id}`,
    ) =>
      service.event({
        id: `${prefix}-${id}`,
        type,
        livemode: false,
        data: { object: { customer } },
      }),
  };
}
const paid = (
  override: Partial<SubscriptionState> = {},
): SubscriptionState => ({
  id: `sub_${randomUUID()}`,
  status: "active",
  priceId: "price_fixture",
  paidUntil: new Date(Date.now() + 86400000),
  cancelAtPeriodEnd: false,
  ...override,
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.stripeWebhookEvent.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await db.$disconnect();
});
describe("billing reconciliation with isolated PostgreSQL", () => {
  it("serializes concurrent checkout requests into one customer and one session", async () => {
    const f = await fixture();
    const urls = await Promise.all(
      Array.from({ length: 5 }, () => f.service.checkout(f.user.id)),
    );
    expect(new Set(urls).size).toBe(1);
    expect(f.gateway.customer).toHaveBeenCalledOnce();
    expect(f.gateway.checkout).toHaveBeenCalledOnce();
    expect((await f.saved()).tier).toBe("FREE");
    expect((await f.saved()).billing?.checkoutAttempt).toBe(1);
  });
  it("creates a new attempt only after the previous Checkout expires", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    f.session("expired");
    await f.service.checkout(f.user.id);
    expect(f.gateway.checkout).toHaveBeenLastCalledWith(
      `cus_${f.user.id}`,
      f.user.id,
      2,
      "price_fixture",
    );
  });
  it("grants paid PRO without a new login and preserves the trial marker", async () => {
    const trial = new Date(Date.now() + 86400000);
    const f = await fixture({ trial });
    await f.service.checkout(f.user.id);
    f.states([paid()]);
    await f.event();
    const saved = await f.saved();
    expect(saved.tier).toBe("PRO");
    expect(saved.trialEndsAt).toEqual(trial);
    expect(resolveAccess(saved).effectiveTier).toBe("PRO");
  });
  it("keeps cancellation-at-period-end access only until the paid deadline", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    const sub = paid({ cancelAtPeriodEnd: true });
    f.states([sub]);
    await f.event();
    const saved = await f.saved();
    expect(resolveAccess(saved).effectiveTier).toBe("PRO");
    expect(resolveAccess(saved, sub.paidUntil!).effectiveTier).toBe("FREE");
  });
  it.each([
    "past_due",
    "unpaid",
    "paused",
    "canceled",
    "incomplete",
    "trialing",
  ])("does not grant PRO for %s", async (status) => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    f.states([paid({ status })]);
    await f.event();
    expect((await f.saved()).tier).toBe("FREE");
  });
  it("does not grant access for active but unpaid or expired subscriptions", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    for (const paidUntil of [null, new Date(Date.now() - 1000)]) {
      f.states([paid({ paidUntil })]);
      await f.event();
      expect((await f.saved()).tier).toBe("FREE");
    }
  });
  it("restores a remaining trial after failure, otherwise FREE, without renewing the trial", async () => {
    const trial = new Date(Date.now() + 86400000);
    const f = await fixture({ trial });
    await f.service.checkout(f.user.id);
    f.states([paid()]);
    await f.event();
    f.states([paid({ status: "past_due" })]);
    await f.event();
    expect((await f.saved()).tier).toBe("TRIAL");
    expect((await f.saved()).trialEndsAt).toEqual(trial);
    await db.user.update({
      where: { id: f.user.id },
      data: { trialEndsAt: new Date(Date.now() - 1000) },
    });
    await f.event();
    expect((await f.saved()).tier).toBe("FREE");
    expect(resolveAccess(await f.saved()).canStartTrial).toBe(false);
  });
  it("does not downgrade ADMIN on webhook delivery", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    await db.user.update({ where: { id: f.user.id }, data: { tier: "ADMIN" } });
    await f.event();
    expect((await f.saved()).tier).toBe("ADMIN");
  });
  it("rejects unverified, missing and ADMIN billing commands", async () => {
    for (const options of [{ verified: false }, { admin: true }]) {
      const f = await fixture(options);
      for (const action of ["checkout", "portal", "refresh"] as const)
        await expect(f.service[action](f.user.id)).rejects.toThrow(
          "Billing is unavailable",
        );
      expect(f.gateway.customer).not.toHaveBeenCalled();
    }
    const f = await fixture();
    await expect(f.service.checkout("missing-user")).rejects.toThrow();
  });
  it("deduplicates events transactionally and ignores stale snapshots", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    f.states([paid()]);
    const results = await Promise.all([
      f.event("duplicate"),
      f.event("duplicate"),
    ]);
    expect(results.sort()).toEqual(["duplicate", "processed"]);
    await f.event("older-deletion", "customer.subscription.deleted");
    expect((await f.saved()).tier).toBe("PRO");
    f.states([]);
    await f.event("current-deletion", "customer.subscription.deleted");
    expect((await f.saved()).tier).toBe("FREE");
  });
  it("rolls back failed event processing so Stripe can retry", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    f.states([paid()]);
    f.gateway.subscriptions.mockRejectedValueOnce(
      new Error("network unavailable"),
    );
    await expect(f.event("retry")).rejects.toThrow("network unavailable");
    expect(
      await db.stripeWebhookEvent.findUnique({
        where: { id: `${prefix}-retry` },
      }),
    ).toBeNull();
    expect(await f.event("retry")).toBe("processed");
    expect((await f.saved()).tier).toBe("PRO");
  });
  it("ignores unknown customers, unsupported events and a different configured price", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    expect(await f.event("unknown", "invoice.paid", "cus_unknown")).toBe(
      "ignored",
    );
    expect(await f.event("unsupported", "customer.created")).toBe("ignored");
    f.states([paid({ priceId: "price_other" })]);
    await f.event();
    expect((await f.saved()).tier).toBe("FREE");
  });
  it("prevents duplicate subscriptions and scopes portal and sync to its owner", async () => {
    const f = await fixture();
    const other = await fixture();
    await f.service.checkout(f.user.id);
    f.states([paid()]);
    expect(await f.service.checkout(f.user.id)).toBe(
      "https://billing.stripe.com/p/session",
    );
    expect(f.gateway.checkout).toHaveBeenCalledOnce();
    await f.service.portal(f.user.id);
    expect(f.gateway.portal).toHaveBeenLastCalledWith(`cus_${f.user.id}`);
    expect((await other.saved()).tier).toBe("FREE");
  });
});

describe("monthly and yearly billing", () => {
  it("accepts an annual paid subscription and retains monthly recognition", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id, "price_yearly");
    f.states([paid({ priceId: "price_yearly" })]);
    await f.event();
    expect((await f.saved()).tier).toBe("PRO");
    expect(await f.service.checkout(f.user.id, "price_fixture")).toBe(
      "https://billing.stripe.com/p/session",
    );
    expect(f.gateway.checkout).toHaveBeenCalledOnce();
  });
  it("expires an open checkout when changing intervals, then reuses the selected option", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    await f.service.checkout(f.user.id, "price_yearly");
    expect(f.gateway.expireCheckout).toHaveBeenCalledOnce();
    expect(f.gateway.checkout).toHaveBeenLastCalledWith(
      `cus_${f.user.id}`,
      f.user.id,
      2,
      "price_yearly",
    );
    f.session("open");
    await f.service.checkout(f.user.id, "price_yearly");
    expect(f.gateway.checkout).toHaveBeenCalledTimes(2);
  });
  it("creates no second checkout if expiring the prior session fails", async () => {
    const f = await fixture();
    await f.service.checkout(f.user.id);
    f.gateway.expireCheckout.mockRejectedValueOnce(
      new Error("already completed"),
    );
    await expect(f.service.checkout(f.user.id, "price_yearly")).rejects.toThrow(
      "already completed",
    );
    expect(f.gateway.checkout).toHaveBeenCalledOnce();
  });
  it("rejects a client-supplied unknown price before creating any Stripe resource", async () => {
    const f = await fixture();
    await expect(f.service.checkout(f.user.id, "price_forged")).rejects.toThrow(
      "Unknown subscription plan",
    );
    expect(f.gateway.customer).not.toHaveBeenCalled();
    expect(f.gateway.checkout).not.toHaveBeenCalled();
  });
});
