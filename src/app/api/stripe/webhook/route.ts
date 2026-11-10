import { getBillingRuntime } from "@/lib/billing/runtime";
import { createWebhookHandler } from "@/lib/billing/webhook";

export const runtime = "nodejs";
export const POST = createWebhookHandler(getBillingRuntime);
