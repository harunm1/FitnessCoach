// Tests for the rest-end alert (D37): everything is off until the user turns it on, each
// channel obeys its own switch, the notification shows only while the tab is hidden, and
// the permission is asked only when the user turns Notification on.
import { describe, expect, it, vi } from "vitest";
import {
  ALERT_STORAGE_KEY,
  DEFAULT_ALERT_PREFS,
  enableNotifications,
  fireRestAlert,
  loadAlertPrefs,
  saveAlertPrefs,
  type AlertEnv,
  type AlertPrefs,
} from "./restAlert";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function env(overrides: Partial<AlertEnv> = {}): AlertEnv {
  return {
    hidden: false,
    playTone: vi.fn(),
    vibrate: vi.fn(),
    notify: vi.fn(),
    ...overrides,
  };
}

const HALF = 0.5;
const LOW = 0.3;
const WAY_TOO_LOUD = 7;
const allOn: AlertPrefs = {
  sound: true,
  volume: HALF,
  vibrate: true,
  notify: true,
};

describe("alert preferences", () => {
  it("are all off by default", () => {
    expect(DEFAULT_ALERT_PREFS).toMatchObject({
      sound: false,
      vibrate: false,
      notify: false,
    });
  });

  it("load as the defaults when nothing is stored", () => {
    expect(loadAlertPrefs(memoryStorage())).toEqual(DEFAULT_ALERT_PREFS);
  });

  it("round-trip through storage", () => {
    const storage = memoryStorage();
    saveAlertPrefs(storage, allOn);
    expect(loadAlertPrefs(storage)).toEqual(allOn);
  });

  it("fall back to the defaults for garbage or a storage that throws", () => {
    expect(
      loadAlertPrefs(memoryStorage({ [ALERT_STORAGE_KEY]: "{nope" })),
    ).toEqual(DEFAULT_ALERT_PREFS);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadAlertPrefs(broken)).toEqual(DEFAULT_ALERT_PREFS);
    expect(() => saveAlertPrefs(broken, allOn)).not.toThrow();
  });

  it("keep the volume between 0 and 1 and ignore other types", () => {
    const stored = JSON.stringify({
      sound: "yes",
      volume: WAY_TOO_LOUD,
      vibrate: 1,
      notify: true,
    });
    const loaded = loadAlertPrefs(
      memoryStorage({ [ALERT_STORAGE_KEY]: stored }),
    );
    expect(loaded.volume).toBe(1);
    expect(loaded.sound).toBe(false);
    expect(loaded.vibrate).toBe(false);
    expect(loaded.notify).toBe(true);
  });
});

describe("fireRestAlert", () => {
  it("does nothing while every switch is off", () => {
    const e = env({ hidden: true });
    fireRestAlert(DEFAULT_ALERT_PREFS, e);
    expect(e.playTone).not.toHaveBeenCalled();
    expect(e.vibrate).not.toHaveBeenCalled();
    expect(e.notify).not.toHaveBeenCalled();
  });

  it("plays the tone at the chosen volume when Sound is on", () => {
    const e = env();
    fireRestAlert({ ...DEFAULT_ALERT_PREFS, sound: true, volume: LOW }, e);
    expect(e.playTone).toHaveBeenCalledWith(LOW);
    expect(e.vibrate).not.toHaveBeenCalled();
    expect(e.notify).not.toHaveBeenCalled();
  });

  it("vibrates only when Vibrate is on", () => {
    const e = env();
    fireRestAlert({ ...DEFAULT_ALERT_PREFS, vibrate: true }, e);
    expect(e.vibrate).toHaveBeenCalledTimes(1);
    expect(e.playTone).not.toHaveBeenCalled();
  });

  it("does not throw when the browser cannot vibrate", () => {
    const e = env({ vibrate: null });
    expect(() => fireRestAlert(allOn, e)).not.toThrow();
  });

  it("shows a notification only while the tab is hidden", () => {
    const visible = env({ hidden: false });
    fireRestAlert(allOn, visible);
    expect(visible.notify).not.toHaveBeenCalled();
    const hidden = env({ hidden: true });
    fireRestAlert(allOn, hidden);
    expect(hidden.notify).toHaveBeenCalledTimes(1);
  });

  it("one channel failing does not stop the others", () => {
    const e = env({
      hidden: true,
      playTone: vi.fn(() => {
        throw new Error("audio blocked");
      }),
    });
    expect(() => fireRestAlert(allOn, e)).not.toThrow();
    expect(e.vibrate).toHaveBeenCalled();
    expect(e.notify).toHaveBeenCalled();
  });
});

describe("enableNotifications", () => {
  it("asks for permission when it has not been decided", async () => {
    const request = vi.fn().mockResolvedValue("granted");
    expect(await enableNotifications({ permission: "default", request })).toBe(
      "granted",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when already granted", async () => {
    const request = vi.fn();
    expect(await enableNotifications({ permission: "granted", request })).toBe(
      "granted",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("does not ask when the user has blocked notifications", async () => {
    const request = vi.fn();
    expect(await enableNotifications({ permission: "denied", request })).toBe(
      "denied",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("reports a browser without the Notification API", async () => {
    expect(await enableNotifications(null)).toBe("unsupported");
  });

  it("treats a request that throws as denied", async () => {
    const request = vi.fn().mockRejectedValue(new Error("no"));
    expect(await enableNotifications({ permission: "default", request })).toBe(
      "denied",
    );
  });
});
