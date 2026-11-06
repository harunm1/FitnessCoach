import type { BillingAction } from "./types";

function waitForRetry(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
  });
}

// Checkout can return before Stripe finishes publishing the paid subscription.
// Every attempt verifies server-side state; the URL never supplies entitlement.
export async function reconcileCheckoutReturn(
  refresh: () => Promise<BillingAction>,
  signal: AbortSignal,
  attempts = 8,
  delay = 1500,
): Promise<BillingAction | undefined> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal.aborted) return;
    let result: BillingAction;
    try {
      result = await refresh();
    } catch {
      result = {
        error: "Couldn’t check billing. Please refresh your billing status.",
      };
    }
    if (signal.aborted) return;
    if (result.paid || result.error || attempt === attempts - 1) return result;
    await waitForRetry(delay, signal);
  }
}
