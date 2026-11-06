import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileCheckoutReturn } from "./checkout-return";

afterEach(() => vi.useRealTimers());
describe("automatic Checkout return reconciliation", () => {
  it("finishes immediately for a verified paid subscription", async () => {
    const refresh = vi
      .fn()
      .mockResolvedValue({ paid: true, message: "PRO ready" });
    expect(
      await reconcileCheckoutReturn(refresh, new AbortController().signal),
    ).toMatchObject({ paid: true });
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("retries while payment is pending and returns the verified upgrade", async () => {
    vi.useFakeTimers();
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({ paid: false })
      .mockResolvedValueOnce({ paid: false })
      .mockResolvedValue({ paid: true });
    const result = reconcileCheckoutReturn(
      refresh,
      new AbortController().signal,
    );
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ paid: true });
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("bounds pending checks without granting access from a success URL", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue({ paid: false });
    const result = reconcileCheckoutReturn(
      refresh,
      new AbortController().signal,
      3,
    );
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ paid: false });
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("stops on a configured server error and handles failed requests", async () => {
    const refresh = vi.fn().mockResolvedValue({ error: "Billing unavailable" });
    expect(
      await reconcileCheckoutReturn(refresh, new AbortController().signal),
    ).toEqual({ error: "Billing unavailable" });
    expect(refresh).toHaveBeenCalledOnce();
    refresh.mockRejectedValueOnce(new Error("network"));
    expect(
      await reconcileCheckoutReturn(refresh, new AbortController().signal),
    ).toHaveProperty("error");
  });
  it("cancels pending retries when the component unmounts", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const refresh = vi.fn().mockResolvedValue({ paid: false });
    const result = reconcileCheckoutReturn(refresh, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.runAllTimersAsync();
    expect(await result).toBeUndefined();
    expect(refresh).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a paid response that arrives after navigation", async () => {
    const controller = new AbortController();
    let finish!: (value: { paid: boolean }) => void;
    const refresh = vi.fn(
      () =>
        new Promise<{ paid: boolean }>((resolve) => {
          finish = resolve;
        }),
    );
    const result = reconcileCheckoutReturn(refresh, controller.signal);
    controller.abort();
    finish({ paid: true });
    expect(await result).toBeUndefined();
  });
});
