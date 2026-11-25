// The rest-end alert (D34): sound, vibration and a notification, each off until the user turns
// it on. Preferences live on the device (audio, vibration and the notification permission are
// per device). Pure with injected effects, so the rules are testable without a browser.

export type AlertPrefs = {
  sound: boolean;
  volume: number; // 0 to 1
  vibrate: boolean;
  notify: boolean;
};

const DEFAULT_VOLUME = 0.7;

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  sound: false,
  volume: DEFAULT_VOLUME,
  vibrate: false,
  notify: false,
};

export const ALERT_STORAGE_KEY = "fc.restAlerts.v1";

type PrefsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const clampVolume = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_VOLUME;

// Anything unreadable, missing or blocked (private window) reads as the defaults.
export function loadAlertPrefs(storage: PrefsStorage): AlertPrefs {
  try {
    const raw = storage.getItem(ALERT_STORAGE_KEY);
    if (raw === null) return DEFAULT_ALERT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_ALERT_PREFS;
    }
    const record = parsed as Record<string, unknown>;
    return {
      sound: record.sound === true,
      volume: clampVolume(record.volume),
      vibrate: record.vibrate === true,
      notify: record.notify === true,
    };
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPrefs(storage: PrefsStorage, prefs: AlertPrefs): void {
  try {
    storage.setItem(ALERT_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the setting simply does not persist.
  }
}

// What the alert may touch. `vibrate` is null where the browser has no vibration motor API
// (iPhone), `notify` is only called while the tab is hidden.
export type AlertEnv = {
  hidden: boolean;
  playTone: (volume: number) => void;
  vibrate: (() => void) | null;
  notify: () => void;
};

// Runs every channel the user turned on; one failing never stops the others.
export function fireRestAlert(prefs: AlertPrefs, env: AlertEnv): void {
  const attempt = (action: () => void) => {
    try {
      action();
    } catch {
      // A blocked tone or notification must not break the timer.
    }
  };
  if (prefs.sound) attempt(() => env.playTone(prefs.volume));
  if (prefs.vibrate && env.vibrate) attempt(env.vibrate);
  if (prefs.notify && env.hidden) attempt(env.notify);
}

export type PermissionResult = "granted" | "denied" | "unsupported";

type PermissionApi = {
  permission: string;
  request: () => Promise<string>;
};

// Called only from the Notification switch's click (never on page load). Asks the browser
// only while the user has not decided; a blocked or granted permission is left alone.
export async function enableNotifications(
  api: PermissionApi | null,
): Promise<PermissionResult> {
  if (api === null) return "unsupported";
  if (api.permission === "granted") return "granted";
  if (api.permission === "denied") return "denied";
  try {
    return (await api.request()) === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
