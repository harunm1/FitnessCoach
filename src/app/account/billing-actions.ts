"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getBillingRuntime } from "@/lib/billing/runtime";
import { checkoutPrice } from "@/lib/billing/plans";
import { BillingError } from "@/lib/billing/config";

import type { BillingAction } from "@/lib/billing/types";
export type { BillingAction } from "@/lib/billing/types";

async function perform(
  action: "checkout" | "portal" | "refresh",
  interval?: unknown,
): Promise<BillingAction> {
  const user = await requireUser();
  try {
    const { service, config, gateway } = await getBillingRuntime();
    if (action === "refresh") {
      const result = await service.refresh(user.id);
      revalidatePath("/account");
      return {
        paid: result.paid,
        message: result.paid
          ? "Your PRO access is ready."
          : "Billing checked. No active paid subscription was found. Your free or remaining trial access is available.",
      };
    }
    if (action === "checkout") {
      const priceId = await checkoutPrice(config, gateway, interval);
      return { url: await service.checkout(user.id, priceId) };
    }
    return { url: await service.portal(user.id) };
  } catch (error) {
    return {
      error:
        error instanceof BillingError
          ? error.message
          : "We couldn’t reach billing. Please try again. Your current access is unchanged.",
    };
  }
}

export async function startCheckout(interval?: unknown) {
  return perform("checkout", interval);
}
export async function openBillingPortal() {
  return perform("portal");
}
export async function refreshBilling() {
  return perform("refresh");
}
