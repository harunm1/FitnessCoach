import "server-only";
import Stripe from "stripe";
import { readBillingConfig, configuredPriceIds } from "./config";
import { createStripeGateway, priceLabel } from "./stripe";
import { BillingService } from "./service";
import { loadBillingPlans } from "./plans";
import type { BillingOverview } from "./types";

let cached:
  | {
      key: string;
      stripe: Stripe;
      gateway: ReturnType<typeof createStripeGateway>;
    }
  | undefined;

export async function getBillingRuntime() {
  const config = readBillingConfig();
  const { prisma } = await import("@/lib/prisma");
  const key = JSON.stringify(config);
  if (!cached || cached.key !== key) {
    const stripe = new Stripe(config.secretKey, {
      timeout: 10000,
      maxNetworkRetries: 1,
    });
    cached = { key, stripe, gateway: createStripeGateway(config, stripe) };
  }
  const { stripe, gateway } = cached;
  return {
    config,
    stripe,
    gateway,
    service: new BillingService(prisma, gateway, configuredPriceIds(config)),
  };
}

export async function billingOverview(
  userId: string,
): Promise<BillingOverview> {
  const unavailable: BillingOverview = {
    available: false,
    hasCustomer: false,
    canSubscribe: false,
    status: null,
    paidUntil: null,
    cancelAtPeriodEnd: false,
    priceLabel: null,
    plans: [],
    currentInterval: null,
  };
  try {
    const { prisma } = await import("@/lib/prisma");
    const billing = await prisma.billingAccount.findUnique({
      where: { userId },
    });
    const current = {
      ...unavailable,
      hasCustomer: Boolean(billing?.stripeCustomerId),
      status: billing?.status ?? null,
      paidUntil: billing?.paidUntil?.toISOString() ?? null,
      cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    };
    try {
      const { gateway, config } = await getBillingRuntime();
      const plans = await loadBillingPlans(config, gateway);
      return {
        ...current,
        available: plans.length > 0,
        canSubscribe:
          !billing?.status ||
          ["canceled", "incomplete_expired"].includes(billing.status),
        priceLabel: plans[0] ? priceLabel(plans[0]) : null,
        plans: plans.map((plan) => ({
          interval: plan.interval,
          label: priceLabel(plan),
        })),
        currentInterval:
          plans.find((plan) => plan.id === billing?.stripePriceId)?.interval ??
          (billing?.stripePriceId &&
          billing.stripePriceId === config.monthlyPriceId
            ? "month"
            : billing?.stripePriceId &&
                billing.stripePriceId === config.yearlyPriceId
              ? "year"
              : null),
      };
    } catch {
      return current;
    }
  } catch {
    return unavailable;
  }
}
