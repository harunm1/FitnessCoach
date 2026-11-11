import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebhookHandler } from "./webhook";
const stripe = new Stripe("sk_test_offline_fixture");
const secret = "whsec_offline_fixture";
const event = vi.fn().mockResolvedValue("processed");
const handler = createWebhookHandler(async () => ({
  stripe,
  config: { webhookSecret: secret },
  service: { event },
}));
function request(
  payload = JSON.stringify({
    id: "evt_offline",
    type: "invoice.paid",
    livemode: false,
    data: { object: { customer: "cus_fixture" } },
  }),
  options: {
    timestamp?: number;
    signature?: string;
    contentLength?: string;
  } = {},
) {
  const signature =
    options.signature ??
    stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: options.timestamp,
    });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: {
      "stripe-signature": signature,
      ...(options.contentLength
        ? { "content-length": options.contentLength }
        : {}),
    },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  event.mockResolvedValue("processed");
});
describe("Stripe raw-body webhook verification", () => {
  it("accepts an authentic test-mode payload", async () => {
    expect((await handler(request())).status).toBe(200);
    expect(event).toHaveBeenCalledOnce();
  });
  it("rejects missing and invalid signatures", async () => {
    expect(
      (
        await handler(
          new Request("http://localhost", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await handler(request("{}", { signature: "invalid" }))).status,
    ).toBe(400);
    expect(event).not.toHaveBeenCalled();
  });
  it("rejects a stale timestamp and signed live event", async () => {
    expect((await handler(request(undefined, { timestamp: 1 }))).status).toBe(
      400,
    );
    expect(
      (await handler(request(JSON.stringify({ livemode: true })))).status,
    ).toBe(400);
    expect(event).not.toHaveBeenCalled();
  });
  it("rejects payload tampering", async () => {
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: "{}",
      secret,
    });
    expect(
      (await handler(request('{"changed":true}', { signature }))).status,
    ).toBe(400);
  });
  it("limits both declared and actual body size", async () => {
    expect(
      (await handler(request("{}", { contentLength: "2000000" }))).status,
    ).toBe(413);
    expect((await handler(request("x".repeat(1024 * 1024 + 1)))).status).toBe(
      413,
    );
    expect(event).not.toHaveBeenCalled();
  });
  it("returns retryable failures and permits a later successful delivery", async () => {
    event.mockRejectedValueOnce(new Error("offline"));
    expect((await handler(request())).status).toBe(500);
    expect((await handler(request())).status).toBe(200);
  });
  it("returns unavailable without configured billing", async () => {
    const unavailable = createWebhookHandler(async () => {
      throw new Error("missing config");
    });
    expect((await unavailable(request())).status).toBe(503);
  });
});
