// @vitest-environment jsdom
// The tone helper must never leak an unhandled rejection when the browser refuses to resume
// the audio context (no tap yet), in either the "suspended" or the iOS "interrupted" state.
import { afterEach, describe, expect, it, vi } from "vitest";

const HALF = 0.5;

function stubAudio(state: string, resume: () => unknown) {
  const param = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = vi.fn(resume);
    createOscillator = () => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    createGain = () => ({ gain: param, connect: vi.fn() });
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe.each(["suspended", "interrupted"])(
  "tone with a %s context",
  (state) => {
    it("tries to resume and swallows a refusal", async () => {
      const rejections: unknown[] = [];
      const listener = (reason: unknown) => rejections.push(reason);
      process.on("unhandledRejection", listener);
      stubAudio(state, () => Promise.reject(new Error("needs a tap")));
      const tone = await import("./tone");
      tone.unlockAudio();
      tone.playTone(HALF);
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.off("unhandledRejection", listener);
      expect(rejections).toEqual([]);
    });

    it("does not throw when an old browser's resume returns nothing", async () => {
      stubAudio(state, () => undefined);
      const tone = await import("./tone");
      expect(() => tone.playTone(HALF)).not.toThrow();
    });
  },
);
