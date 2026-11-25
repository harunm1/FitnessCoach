// @vitest-environment jsdom
// Tests for the "Alerts on this device" box on the account page (D36): everything starts off,
// each switch saves on this device, the browser's notification permission is asked only when
// the user turns Notification on, and the iPhone limit is stated plainly.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALERT_STORAGE_KEY } from "@/lib/alerts/restAlert";
import { RestAlertsForm } from "./rest-alerts-form";

const { playTone, unlockAudio } = vi.hoisted(() => ({
  playTone: vi.fn(),
  unlockAudio: vi.fn(),
}));
vi.mock("@/lib/alerts/tone", () => ({ playTone, unlockAudio }));

const LOUD = 80;
const LOUD_VOLUME = 0.8;
const SAVED_VOLUME = 0.4;

function stubNotification(permission: string, result = "granted") {
  const requestPermission = vi.fn().mockResolvedValue(result);
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

function stored() {
  const raw = window.localStorage.getItem(ALERT_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(0);
  });
}

async function renderForm() {
  render(<RestAlertsForm />);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    value: vi.fn(),
  });
  playTone.mockClear();
  unlockAudio.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RestAlertsForm", () => {
  it("starts with Sound, Vibrate and Notification all off", async () => {
    stubNotification("default");
    await renderForm();
    expect(
      (screen.getByLabelText("Sound when a rest ends") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Vibrate when a rest ends") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (
        screen.getByLabelText(
          "Notification when the page is in the background",
        ) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it("does not ask for notification permission when the page loads", async () => {
    const request = stubNotification("default");
    await renderForm();
    expect(request).not.toHaveBeenCalled();
  });

  it("asks once, from the Notification switch, and keeps it on when allowed", async () => {
    const request = stubNotification("default", "granted");
    await renderForm();
    await act(async () => {
      screen
        .getByLabelText("Notification when the page is in the background")
        .click();
    });
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      (
        screen.getByLabelText(
          "Notification when the page is in the background",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(stored()?.notify).toBe(true);
  });

  it("switches back off and says why when the browser blocks notifications", async () => {
    stubNotification("default", "denied");
    await renderForm();
    await act(async () => {
      screen
        .getByLabelText("Notification when the page is in the background")
        .click();
    });
    await flush();
    expect(
      (
        screen.getByLabelText(
          "Notification when the page is in the background",
        ) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("blocked");
    expect(stored()?.notify ?? false).toBe(false);
  });

  it("turning Notification off never asks the browser", async () => {
    const request = stubNotification("granted");
    window.localStorage.setItem(
      ALERT_STORAGE_KEY,
      JSON.stringify({
        sound: false,
        volume: SAVED_VOLUME,
        vibrate: false,
        notify: true,
      }),
    );
    await renderForm();
    await act(async () => {
      screen
        .getByLabelText("Notification when the page is in the background")
        .click();
    });
    await flush();
    expect(request).not.toHaveBeenCalled();
    expect(stored()?.notify).toBe(false);
  });

  it("saves the Sound switch and the volume on this device", async () => {
    stubNotification("default");
    await renderForm();
    await act(async () => {
      screen.getByLabelText("Sound when a rest ends").click();
    });
    expect(stored()?.sound).toBe(true);
    fireEvent.change(screen.getByLabelText("Volume"), {
      target: { value: String(LOUD) },
    });
    expect(stored()?.volume).toBe(LOUD_VOLUME);
  });

  it("plays a test tone at the chosen volume and unlocks audio from the tap", async () => {
    stubNotification("default");
    await renderForm();
    await act(async () => {
      screen.getByRole("button", { name: "Play test tone" }).click();
    });
    expect(unlockAudio).toHaveBeenCalled();
    expect(playTone).toHaveBeenCalledTimes(1);
  });

  it("disables Vibrate where the browser cannot vibrate", async () => {
    stubNotification("default");
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: undefined,
    });
    await renderForm();
    expect(
      (screen.getByLabelText("Vibrate when a rest ends") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("disables Notification where the browser has no Notification API", async () => {
    vi.stubGlobal("Notification", undefined);
    await renderForm();
    expect(
      (
        screen.getByLabelText(
          "Notification when the page is in the background",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
  });

  it("states the Android Chrome limit too", async () => {
    stubNotification("default");
    await renderForm();
    expect(document.body.textContent).toContain("Android");
  });

  it("states the iPhone limit plainly", async () => {
    stubNotification("default");
    await renderForm();
    const text = document.body.textContent ?? "";
    expect(text).toContain("iPhone");
    expect(text).toContain("Home Screen");
    expect(text).toContain("only while the page is open");
  });

  it("restores saved choices on this device", async () => {
    stubNotification("granted");
    window.localStorage.setItem(
      ALERT_STORAGE_KEY,
      JSON.stringify({
        sound: true,
        volume: SAVED_VOLUME,
        vibrate: true,
        notify: true,
      }),
    );
    await renderForm();
    expect(
      (screen.getByLabelText("Sound when a rest ends") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Vibrate when a rest ends") as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});
