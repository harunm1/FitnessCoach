export type BillingInterval = "month" | "year";

export type PlanPrice = {
  id: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  intervalCount: number;
};
export type SubscriptionState = {
  id: string;
  status: string;
  priceId: string;
  paidUntil: Date | null;
  cancelAtPeriodEnd: boolean;
};
export type CheckoutState = {
  id: string;
  status: string | null;
  url: string | null;
  priceId: string | null;
};
export interface BillingGateway {
  price(priceId?: string): Promise<PlanPrice>;
  customer(user: { id: string; email: string; name: string }): Promise<string>;
  subscriptions(customerId: string): Promise<SubscriptionState[]>;
  checkout(
    customerId: string,
    userId: string,
    attempt: number,
    priceId?: string,
  ): Promise<CheckoutState>;
  retrieveCheckout(id: string): Promise<CheckoutState>;
  expireCheckout(id: string): Promise<void>;
  portal(customerId: string): Promise<string>;
}
export type BillingOverview = {
  available: boolean;
  hasCustomer: boolean;
  canSubscribe: boolean;
  status: string | null;
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
  priceLabel: string | null;
  plans: { interval: BillingInterval; label: string }[];
  currentInterval: BillingInterval | null;
};

export type BillingAction = {
  url?: string;
  message?: string;
  error?: string;
  paid?: boolean;
};
