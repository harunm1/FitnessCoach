// Glue between the pure alert rules and the browser (D34). Nothing here asks for a
// permission: that happens only from the settings switch (`requestNotifications`).
import {
  enableNotifications,
  fireRestAlert,
  loadAlertPrefs,
  saveAlertPrefs,
  type AlertEnv,
  type AlertPrefs,
  type PermissionResult,
} from "./restAlert";
import { playTone, unlockAudio } from "./tone";

export { unlockAudio };

const BUZZ_MS = 200;
const PAUSE_MS = 100;
const VIBRATION_PATTERN = [BUZZ_MS, PAUSE_MS, BUZZ_MS];
const NOTIFICATION_TITLE = "Rest over";
const NOTIFICATION_BODY = "Time for your next set.";
const NOTIFICATION_TAG = "fc-rest-over";

function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage throws on access
  }
}

export function readAlertPrefs(): AlertPrefs {
  const storage = deviceStorage();
  return storage ? loadAlertPrefs(storage) : loadAlertPrefs(emptyStorage);
}

const emptyStorage = { getItem: () => null, setItem: () => undefined };

export function writeAlertPrefs(prefs: AlertPrefs): void {
  const storage = deviceStorage();
  if (storage) saveAlertPrefs(storage, prefs);
}

function browserEnv(): AlertEnv {
  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  return {
    hidden: document.hidden,
    playTone,
    vibrate: canVibrate ? () => navigator.vibrate(VIBRATION_PATTERN) : null,
    notify: () => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      new Notification(NOTIFICATION_TITLE, {
        body: NOTIFICATION_BODY,
        tag: NOTIFICATION_TAG,
      });
    },
  };
}

// The rest ended: run whatever the user turned on for this device.
export function alertRestEnded(): void {
  fireRestAlert(readAlertPrefs(), browserEnv());
}

export function notificationsSupported(): boolean {
  return typeof Notification !== "undefined";
}

export function vibrationSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

// Called only from the Notification switch's click handler.
export function requestNotifications(): Promise<PermissionResult> {
  return enableNotifications(
    typeof Notification === "undefined"
      ? null
      : {
          permission: Notification.permission,
          request: () => Notification.requestPermission(),
        },
  );
}
