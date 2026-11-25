// A double tap on Log set (D31): storing a set on the device takes milliseconds, after
// which the form already offers the next set, so a second tap close behind is ignored.
import { describe, expect, it } from "vitest";
import { createTapGuard, DOUBLE_TAP_WINDOW_MS } from "./tapGuard";

const START = 1_000;
const JUST_INSIDE = DOUBLE_TAP_WINDOW_MS - 1;

describe("createTapGuard", () => {
  it("lets the first tap through and stops one close behind it", () => {
    let now = START;
    const allow = createTapGuard(() => now);
    expect(allow()).toBe(true);
    now += JUST_INSIDE;
    expect(allow()).toBe(false);
  });

  it("lets a tap through once the window has passed", () => {
    let now = START;
    const allow = createTapGuard(() => now);
    allow();
    now += DOUBLE_TAP_WINDOW_MS;
    expect(allow()).toBe(true);
  });

  it("keeps the window from the last allowed tap, not the ignored ones", () => {
    let now = START;
    const allow = createTapGuard(() => now);
    allow();
    now += JUST_INSIDE;
    allow();
    now = START + DOUBLE_TAP_WINDOW_MS;
    expect(allow()).toBe(true);
  });
});
