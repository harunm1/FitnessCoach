import type Stripe from "stripe";

export type WebhookRuntime = {
  config: { webhookSecret: string };
  stripe: Stripe;
  service: { event(event: Stripe.Event): Promise<string> };
};
const LIMIT = 1024 * 1024;

export function createWebhookHandler(runtime: () => Promise<WebhookRuntime>) {
  return async function POST(request: Request) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });
    if (Number(request.headers.get("content-length")) > LIMIT)
      return new Response("Payload too large", { status: 413 });
    let billing: WebhookRuntime;
    try {
      billing = await runtime();
    } catch {
      return new Response("Billing unavailable", { status: 503 });
    }
    let event: Stripe.Event;
    try {
      const reader = request.body?.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      if (!reader) return new Response("Missing payload", { status: 400 });
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > LIMIT) {
            await reader.cancel();
            return new Response("Payload too large", { status: 413 });
          }
          parts.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      event = billing.stripe.webhooks.constructEvent(
        Buffer.concat(parts),
        signature,
        billing.config.webhookSecret,
      );
      if (event.livemode)
        return new Response("Test events only", { status: 400 });
    } catch {
      return new Response("Invalid signature or payload", { status: 400 });
    }
    try {
      await billing.service.event(event);
      return Response.json({ received: true });
    } catch {
      return new Response("Unable to synchronize billing; retry delivery", {
        status: 500,
      });
    }
  };
}
