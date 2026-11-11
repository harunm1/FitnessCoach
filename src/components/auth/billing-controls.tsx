"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reconcileCheckoutReturn } from "@/lib/billing/checkout-return";
import {
  startCheckout,
  openBillingPortal,
  refreshBilling,
  type BillingAction,
} from "@/app/account/billing-actions";
import type { BillingOverview, BillingInterval } from "@/lib/billing/types";
import styles from "./account.module.css";

export function BillingControls({
  overview,
  returned,
}: {
  overview: BillingOverview;
  returned?: string;
}) {
  const router = useRouter();
  const optionsId = useId();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const selectedPlan =
    overview.plans.find((plan) => plan.interval === interval) ??
    overview.plans[0];
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BillingAction | null>(null);
  const inFlight = useRef<Promise<BillingAction> | null>(null);
  const checkingReturn =
    overview.hasCustomer &&
    ["success", "returned"].includes(returned ?? "") &&
    !result;

  useEffect(() => {
    if (
      !overview.hasCustomer ||
      !["success", "returned"].includes(returned ?? "")
    )
      return;
    const controller = new AbortController();
    const refresh = () => {
      // Strict Mode and route updates can overlap: share only an in-flight read.
      const request = inFlight.current ?? refreshBilling();
      inFlight.current = request;
      return request.finally(() => {
        if (inFlight.current === request) inFlight.current = null;
      });
    };
    void reconcileCheckoutReturn(
      refresh,
      controller.signal,
      returned === "success" ? 8 : 1,
    ).then((value) => {
      if (!value || controller.signal.aborted) return;
      setResult(value);
      if (!value.error) router.refresh();
    });
    return () => controller.abort();
  }, [returned, overview.hasCustomer, router]);

  useEffect(() => {
    if (!overview.hasCustomer) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [overview.hasCustomer, router]);

  function run(action: () => Promise<BillingAction>) {
    startTransition(async () => {
      try {
        const value = await action();
        if (value.url) window.location.assign(value.url);
        else {
          setResult(value);
          if (typeof value.paid === "boolean") router.refresh();
        }
      } catch {
        setResult({ error: "Couldn’t open billing. Please try again." });
      }
    });
  }

  return (
    <section className={styles.card} aria-labelledby="billing-heading">
      <div className={styles.cardHeading}>
        <h2 id="billing-heading" className={styles.cardTitle}>
          Your membership
        </h2>
        <span className={styles.tierPill}>Test mode</span>
      </div>
      <p className={styles.introText}>Manage your membership and billing.</p>
      {overview.available && overview.canSubscribe && (
        <>
          {overview.plans.length > 1 ? (
            <fieldset
              className={styles.billingPlans}
              disabled={pending || checkingReturn}
            >
              <legend>Choose your billing period</legend>
              {overview.plans.map((plan) => (
                <label key={plan.interval} className={styles.billingOption}>
                  <input
                    type="radio"
                    name={optionsId}
                    value={plan.interval}
                    checked={selectedPlan?.interval === plan.interval}
                    onChange={() => setInterval(plan.interval)}
                  />
                  <span>
                    <strong>
                      {plan.interval === "month" ? "Monthly" : "Yearly"}
                    </strong>
                    <small>{plan.label}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className={styles.billingPrice}>{selectedPlan?.label}</p>
          )}
          <p className={styles.trialFinePrint}>
            Recurring subscription. Starts immediately, separate from your free
            trial. Yearly billing is charged upfront. Any taxes are shown at
            Checkout. Use a Stripe test card; no real charge.
          </p>
        </>
      )}
      {!overview.available && (
        <p className={styles.trialFinePrint}>
          New subscriptions aren’t available right now. Your current access is
          unchanged.
          {overview.hasCustomer &&
            " You can still manage or refresh your membership below."}
        </p>
      )}
      {overview.status && (
        <p className={styles.trialStatus}>
          Subscription: {overview.status.replaceAll("_", " ")}
          {overview.currentInterval
            ? ` · ${overview.currentInterval === "month" ? "Monthly" : "Yearly"}`
            : ""}
          {overview.cancelAtPeriodEnd
            ? " · Cancels at the end of the paid period"
            : ""}
        </p>
      )}
      {overview.paidUntil && (
        <p className={styles.trialFinePrint}>
          Paid access through{" "}
          <time dateTime={overview.paidUntil}>
            {new Date(overview.paidUntil).toUTCString()}
          </time>
          .
        </p>
      )}
      <div className={styles.billingButtons}>
        {overview.available && overview.canSubscribe && selectedPlan && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={pending || checkingReturn}
            onClick={() => run(() => startCheckout(selectedPlan.interval))}
          >
            Upgrade to PRO (test)
          </button>
        )}
        {overview.hasCustomer && (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pending || checkingReturn}
            onClick={() => run(openBillingPortal)}
          >
            Manage billing
          </button>
        )}
        {(overview.available || overview.hasCustomer) && (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pending || checkingReturn}
            onClick={() => run(refreshBilling)}
          >
            Refresh billing status
          </button>
        )}
      </div>
      {pending && <p role="status">Connecting to billing…</p>}
      {returned === "cancelled" && (
        <p className={styles.trialStatus}>
          Checkout was cancelled. Your current access is unchanged.
        </p>
      )}
      {checkingReturn && (
        <p role="status" className={styles.trialFinePrint}>
          Checking your membership. Your access updates automatically once
          payment is verified.
        </p>
      )}
      {result?.error && (
        <p role="alert" className={styles.errorNotice}>
          {result.error}
        </p>
      )}
      {result?.message && (
        <p role="status" className={styles.trialStatus}>
          {result.message}
        </p>
      )}
    </section>
  );
}
