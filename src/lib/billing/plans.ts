import { BillingError, configuredPriceIds, type BillingConfig } from "./config";
import type { BillingGateway, BillingInterval, PlanPrice } from "./types";

export async function loadBillingPlans(
  config: BillingConfig,
  gateway: BillingGateway,
): Promise<PlanPrice[]> {
  const results = await Promise.allSettled(
    configuredPriceIds(config).map((id) => gateway.price(id)),
  );
  const selected = new Map<BillingInterval, PlanPrice>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const plan = result.value;
    const explicit =
      plan.interval === "month" ? config.monthlyPriceId : config.yearlyPriceId;
    if (plan.intervalCount !== 1 || (explicit && explicit !== plan.id))
      continue;
    if (!selected.has(plan.interval)) selected.set(plan.interval, plan);
  }
  return [selected.get("month"), selected.get("year")].filter(
    (plan): plan is PlanPrice => Boolean(plan),
  );
}

export async function checkoutPrice(
  config: BillingConfig,
  gateway: BillingGateway,
  interval?: unknown,
): Promise<string> {
  if (interval !== undefined && interval !== "month" && interval !== "year")
    throw new BillingError("Choose monthly or yearly billing.");
  const plans = await loadBillingPlans(config, gateway);
  const plan = interval
    ? plans.find((p) => p.interval === interval)
    : (plans.find((p) => p.id === config.priceId) ?? plans[0]);
  if (!plan)
    throw new BillingError(
      "That billing option is unavailable. Please try again later.",
    );
  return plan.id;
}
