export type BillingConfig = {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
  baseURL: string;
};

export class BillingError extends Error {}

export function readBillingConfig(
  env: Record<string, string | undefined> = process.env,
): BillingConfig {
  const legacy = env.STRIPE_PRICE_ID?.trim() || undefined;
  const monthly = env.STRIPE_MONTHLY_PRICE_ID?.trim() || undefined;
  const yearly = env.STRIPE_YEARLY_PRICE_ID?.trim() || undefined;
  const ids = [legacy, monthly, yearly].filter((id): id is string =>
    Boolean(id),
  );
  if (
    !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ||
    !ids.length ||
    ids.some((id) => !id.startsWith("price_")) ||
    (monthly && monthly === yearly)
  )
    throw new BillingError(
      "Subscriptions are unavailable right now. Your current access is unchanged.",
    );
  let origin: URL;
  try {
    origin = new URL(env.BETTER_AUTH_URL ?? "");
  } catch {
    throw new BillingError("Billing requires a valid application origin.");
  }
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw new BillingError(
      "Billing requires HTTPS outside localhost and an origin without a path.",
    );
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceId: legacy ?? monthly ?? yearly!,
    monthlyPriceId: monthly,
    yearlyPriceId: yearly,
    baseURL: origin.origin,
  };
}

// Retain the legacy ID for existing subscriptions while explicit prices are added.
export function configuredPriceIds(config: BillingConfig): string[] {
  return [
    ...new Set(
      [config.monthlyPriceId, config.yearlyPriceId, config.priceId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
}
