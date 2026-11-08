import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { BillingGateway, SubscriptionState } from "./types";
import { BillingError } from "./config";
import { stripeURL } from "./stripe";

export const BILLING_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

export class BillingService {
  private readonly priceIds: readonly string[];
  constructor(
    private db: PrismaClient,
    private gateway: BillingGateway,
    priceIds: string | readonly string[],
  ) {
    this.priceIds = typeof priceIds === "string" ? [priceIds] : priceIds;
  }

  private async locked<T>(
    userId: string,
    run: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        // The same lock serializes checkout, refresh and webhook reconciliation.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        return run(tx);
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  private async account(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { billing: true },
    });
    if (!user?.emailVerified || user.tier === "ADMIN")
      throw new BillingError("Billing is unavailable for this account.");
    return user;
  }

  private async reconcile(
    tx: Prisma.TransactionClient,
    userId: string,
    customerId: string,
  ) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const subscriptions = (await this.gateway.subscriptions(customerId)).filter(
      (s) => this.priceIds.includes(s.priceId),
    );
    const now = new Date();
    const paid = subscriptions
      .filter((s) => s.status === "active" && s.paidUntil && s.paidUntil > now)
      .sort((a, b) => b.paidUntil!.getTime() - a.paidUntil!.getTime())[0];
    const blocking = subscriptions.find(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    );
    const current: SubscriptionState | undefined =
      paid ?? blocking ?? subscriptions[0];
    await tx.billingAccount.update({
      where: { userId },
      data: {
        stripeSubscriptionId: current?.id ?? null,
        status: current?.status ?? null,
        stripePriceId: current?.priceId ?? null,
        paidUntil: paid?.paidUntil ?? null,
        cancelAtPeriodEnd: current?.cancelAtPeriodEnd ?? false,
        lastSyncedAt: now,
      },
    });
    const tier = paid
      ? "PRO"
      : user.trialEndsAt && user.trialEndsAt > now
        ? "TRIAL"
        : "FREE";
    await tx.user.updateMany({
      where: { id: userId, tier: { not: "ADMIN" } },
      data: { tier },
    });
    return { paid: Boolean(paid), blocking: Boolean(blocking) };
  }

  async checkout(userId: string, selectedPriceId = this.priceIds[0]) {
    if (!selectedPriceId || !this.priceIds.includes(selectedPriceId))
      throw new BillingError("Unknown subscription plan.");
    await this.gateway.price(selectedPriceId);
    return this.locked(userId, async (tx) => {
      const user = await this.account(tx, userId);
      let billing =
        user.billing ?? (await tx.billingAccount.create({ data: { userId } }));
      const customerId =
        billing.stripeCustomerId ?? (await this.gateway.customer(user));
      if (!billing.stripeCustomerId)
        billing = await tx.billingAccount.update({
          where: { userId },
          data: { stripeCustomerId: customerId },
        });
      const state = await this.reconcile(tx, userId, customerId);
      if (state.blocking)
        return stripeURL(
          await this.gateway.portal(customerId),
          "billing.stripe.com",
        );
      if (billing.stripeCheckoutSessionId) {
        const existing = await this.gateway.retrieveCheckout(
          billing.stripeCheckoutSessionId,
        );
        if (existing.status === "open") {
          if (existing.priceId === selectedPriceId)
            return stripeURL(existing.url, "checkout.stripe.com");
          // Close the prior unpaid session before offering a different interval.
          await this.gateway.expireCheckout(existing.id);
        }
      }
      const attempt = billing.checkoutAttempt + 1;
      const session = await this.gateway.checkout(
        customerId,
        userId,
        attempt,
        selectedPriceId,
      );
      const url = stripeURL(session.url, "checkout.stripe.com");
      await tx.billingAccount.update({
        where: { userId },
        data: { stripeCheckoutSessionId: session.id, checkoutAttempt: attempt },
      });
      return url;
    });
  }

  async portal(userId: string) {
    return this.locked(userId, async (tx) => {
      const user = await this.account(tx, userId);
      if (!user.billing?.stripeCustomerId)
        throw new BillingError("Start a subscription before opening billing.");
      return stripeURL(
        await this.gateway.portal(user.billing.stripeCustomerId),
        "billing.stripe.com",
      );
    });
  }

  async refresh(userId: string) {
    return this.locked(userId, async (tx) => {
      const user = await this.account(tx, userId);
      if (!user.billing?.stripeCustomerId) return { paid: false };
      return this.reconcile(tx, userId, user.billing.stripeCustomerId);
    });
  }

  async event(event: {
    id: string;
    type: string;
    livemode: boolean;
    data: { object: unknown };
  }) {
    if (event.livemode)
      throw new BillingError("Only test-mode events are supported.");
    if (!BILLING_EVENTS.has(event.type)) return "ignored";
    const object = event.data.object as {
      customer?: string | { id?: string };
    } | null;
    const customerId =
      typeof object?.customer === "string"
        ? object.customer
        : object?.customer?.id;
    if (!customerId) return "ignored";
    const billing = await this.db.billingAccount.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!billing) return "ignored";
    return this.locked(billing.userId, async (tx) => {
      if (await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } }))
        return "duplicate";
      // Event snapshots can arrive out of order: always fetch Stripe's current state.
      await this.reconcile(tx, billing.userId, customerId);
      await tx.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
      return "processed";
    });
  }
}
