import Stripe from "stripe";
import { BillingError, configuredPriceIds, type BillingConfig } from "./config";
import type { BillingGateway, PlanPrice, SubscriptionState } from "./types";

export function stripeURL(
  value: string | null,
  host: "checkout.stripe.com" | "billing.stripe.com",
) {
  if (!value)
    throw new BillingError(
      "Stripe did not return a billing link. Please try again.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password ||
    url.port
  )
    throw new BillingError("Stripe returned an invalid billing link.");
  return url.href;
}

export function validatePrice(price: Stripe.Price): PlanPrice {
  if (
    price.livemode ||
    !price.active ||
    price.type !== "recurring" ||
    !price.recurring ||
    price.recurring.usage_type !== "licensed" ||
    price.billing_scheme !== "per_unit" ||
    !Number.isSafeInteger(price.unit_amount) ||
    !price.unit_amount ||
    price.unit_amount < 0 ||
    !["month", "year"].includes(price.recurring.interval)
  )
    throw new BillingError(
      "The subscription plan is unavailable. Please try again later.",
    );
  return {
    id: price.id,
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval as "month" | "year",
    intervalCount: price.recurring.interval_count,
  };
}

export function priceLabel(price: PlanPrice) {
  // Stripe uses zero minor digits for these charge currencies; ISK/UGX use two.
  const zero = new Set(
    "bif clp djf gnf jpy kmf krw mga pyg rwf vnd vuv xaf xof xpf".split(" "),
  );
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.amount / (zero.has(price.currency) ? 1 : 100));
  return `${amount} ${price.currency.toUpperCase()} / ${price.intervalCount === 1 ? price.interval : `${price.intervalCount} ${price.interval}s`}`;
}

export function createStripeGateway(
  config: BillingConfig,
  stripe = new Stripe(config.secretKey, {
    timeout: 10000,
    maxNetworkRetries: 1,
  }),
): BillingGateway {
  const cached = new Map<string, { value: PlanPrice; until: number }>();
  const allowed = configuredPriceIds(config);
  return {
    async price(priceId = config.priceId) {
      if (!allowed.includes(priceId))
        throw new BillingError("Unknown subscription plan.");
      const prior = cached.get(priceId);
      if (prior && prior.until > Date.now()) return prior.value;
      const value = validatePrice(await stripe.prices.retrieve(priceId));
      if (
        value.id !== priceId ||
        (priceId === config.monthlyPriceId &&
          (value.interval !== "month" || value.intervalCount !== 1)) ||
        (priceId === config.yearlyPriceId &&
          (value.interval !== "year" || value.intervalCount !== 1))
      )
        throw new BillingError(
          "The billing option does not match its configured interval.",
        );
      cached.set(priceId, { value, until: Date.now() + 60000 });
      return value;
    },
    async customer(user) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: user.name,
          metadata: { fitnesscoachUserId: user.id },
        },
        { idempotencyKey: `fitnesscoach-customer-${user.id}` },
      );
      if (customer.livemode)
        throw new BillingError("Only test-mode billing is supported.");
      return customer.id;
    },
    async subscriptions(customerId) {
      const result: SubscriptionState[] = [];
      let count = 0;
      for await (const sub of stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
        expand: ["data.latest_invoice"],
      })) {
        if (
          ++count > 1000 ||
          sub.livemode ||
          (typeof sub.customer === "string"
            ? sub.customer
            : sub.customer.id) !== customerId
        )
          throw new BillingError("Unable to verify subscription status.");
        if (sub.items.has_more)
          throw new BillingError("Unsupported subscription configuration.");
        const item = sub.items.data.find((i) => allowed.includes(i.price.id));
        if (!item) continue;
        let paidUntil: Date | null = null;
        if (
          sub.status === "active" &&
          !sub.pause_collection &&
          sub.items.data.length === 1 &&
          item.quantity === 1 &&
          sub.latest_invoice
        ) {
          const invoice =
            typeof sub.latest_invoice === "string"
              ? await stripe.invoices.retrieve(sub.latest_invoice)
              : sub.latest_invoice;
          const customer =
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id;
          if (
            !invoice.livemode &&
            invoice.status === "paid" &&
            customer === customerId
          ) {
            let paidEnd = 0;
            const lines = invoice.lines.has_more
              ? stripe.invoices.listLineItems(invoice.id, { limit: 100 })
              : invoice.lines.data;
            let lineCount = 0;
            for await (const line of lines) {
              if (++lineCount > 1000)
                throw new BillingError("Unable to verify invoice lines.");
              const price = line.pricing?.price_details?.price;
              const priceId = typeof price === "string" ? price : price?.id;
              // Current Stripe invoices identify the subscription through parent.
              const subscriptionId =
                line.parent?.type === "subscription_item_details"
                  ? line.parent.subscription_item_details?.subscription
                  : null;
              if (
                priceId === item.price.id &&
                subscriptionId === sub.id &&
                line.quantity === 1 &&
                line.amount >= 0
              )
                paidEnd = Math.max(paidEnd, line.period.end);
            }
            const end = Math.min(paidEnd, item.current_period_end);
            if (end > 0) paidUntil = new Date(end * 1000);
          }
        }
        result.push({
          id: sub.id,
          status: sub.status,
          priceId: item.price.id,
          paidUntil,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      return result;
    },
    async checkout(customer, userId, attempt, priceId = config.priceId) {
      if (!allowed.includes(priceId))
        throw new BillingError("Unknown subscription plan.");
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer,
          client_reference_id: userId,
          line_items: [{ price: priceId, quantity: 1 }],
          allowed_payment_method_types: ["card"],
          metadata: { fitnesscoachUserId: userId },
          subscription_data: { metadata: { fitnesscoachUserId: userId } },
          success_url: `${config.baseURL}/account?billing=success`,
          cancel_url: `${config.baseURL}/account?billing=cancelled`,
        },
        {
          idempotencyKey: `fitnesscoach-checkout-${userId}-${attempt}-${priceId}`,
        },
      );
      if (session.livemode)
        throw new BillingError("Only test-mode billing is supported.");
      return {
        id: session.id,
        priceId,
        status: session.status,
        url: session.url ? stripeURL(session.url, "checkout.stripe.com") : null,
      };
    },
    async retrieveCheckout(id) {
      const session = await stripe.checkout.sessions.retrieve(id, {
        expand: ["line_items"],
      });
      if (session.livemode)
        throw new BillingError("Only test-mode billing is supported.");
      return {
        id: session.id,
        priceId:
          session.line_items &&
          !session.line_items.has_more &&
          session.line_items.data.length === 1
            ? (session.line_items.data[0].price?.id ?? null)
            : null,
        status: session.status,
        url: session.url ? stripeURL(session.url, "checkout.stripe.com") : null,
      };
    },
    async expireCheckout(id) {
      const session = await stripe.checkout.sessions.expire(id);
      if (session.livemode)
        throw new BillingError("Only test-mode billing is supported.");
    },
    async portal(customer) {
      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url: `${config.baseURL}/account?billing=returned`,
      });
      return stripeURL(session.url, "billing.stripe.com");
    },
  };
}
