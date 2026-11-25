"use client";

import { useEffect, useState } from "react";
import {
  notificationsSupported,
  readAlertPrefs,
  requestNotifications,
  unlockAudio,
  vibrationSupported,
  writeAlertPrefs,
} from "@/lib/alerts/browserAlert";
import { DEFAULT_ALERT_PREFS, type AlertPrefs } from "@/lib/alerts/restAlert";
import { playTone } from "@/lib/alerts/tone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const PERCENT = 100;
const BLOCKED_MESSAGE =
  "Notifications are blocked for this site. Allow them in your browser's site settings, then turn this on again.";

// The rest-end alerts (D34), saved on this device only: the tone, vibration and the
// notification permission are all per device. Everything starts off, and the browser's
// permission prompt appears only when the Notification box is ticked here.
export function RestAlertsForm() {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_ALERT_PREFS);
  const [canVibrate, setCanVibrate] = useState(false);
  const [canNotify, setCanNotify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Reads this device's saved choices after mount (the server render shows the defaults).
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPrefs(readAlertPrefs());
      setCanVibrate(vibrationSupported());
      setCanNotify(notificationsSupported());
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function update(next: AlertPrefs) {
    setPrefs(next);
    writeAlertPrefs(next);
  }

  async function toggleNotify(wantOn: boolean) {
    setMessage(null);
    if (!wantOn) {
      update({ ...prefs, notify: false });
      return;
    }
    const result = await requestNotifications();
    if (result === "granted") {
      update({ ...prefs, notify: true });
      return;
    }
    update({ ...prefs, notify: false });
    setMessage(
      result === "denied"
        ? BLOCKED_MESSAGE
        : "This browser has no notifications.",
    );
  }

  function testTone() {
    unlockAudio();
    playTone(prefs.volume);
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-2">
        <Label className="cursor-pointer gap-2">
          <input
            type="checkbox"
            checked={prefs.sound}
            onChange={(event) => {
              if (event.target.checked) unlockAudio();
              update({ ...prefs, sound: event.target.checked });
            }}
            className="size-4 accent-current"
          />
          Sound when a rest ends
        </Label>
        <div className="flex flex-wrap items-center gap-3 pl-6">
          <Label className="gap-2 text-sm">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={PERCENT}
              step={1}
              value={Math.round(prefs.volume * PERCENT)}
              onChange={(event) =>
                update({
                  ...prefs,
                  volume: Number(event.target.value) / PERCENT,
                })
              }
              aria-label="Volume"
            />
          </Label>
          <Button type="button" variant="outline" onClick={testTone}>
            Play test tone
          </Button>
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="cursor-pointer gap-2">
          <input
            type="checkbox"
            checked={prefs.vibrate}
            disabled={!canVibrate}
            onChange={(event) =>
              update({ ...prefs, vibrate: event.target.checked })
            }
            className="size-4 accent-current"
          />
          Vibrate when a rest ends
        </Label>
        {!canVibrate && (
          <p className="m-0 pl-6 text-xs text-foreground/60">
            This browser cannot vibrate (Android Chrome can; iPhone cannot).
          </p>
        )}
      </div>
      <div className="grid gap-1">
        <Label className="cursor-pointer gap-2">
          <input
            type="checkbox"
            checked={prefs.notify}
            disabled={!canNotify}
            onChange={(event) => void toggleNotify(event.target.checked)}
            className="size-4 accent-current"
          />
          Notification when the page is in the background
        </Label>
        {message && (
          <p role="alert" className="m-0 pl-6 text-sm text-red-800">
            {message}
          </p>
        )}
      </div>
      <p className="m-0 text-xs text-foreground/70">
        These switches are saved on this device only, and all start off. On an
        iPhone, a web page cannot notify you in the background (screen off or
        another app open) unless it is installed to the Home Screen with Web
        Push, which this app does not use, so the sound plays only while the
        page is open. The rest countdown itself stays correct while the screen
        is off.
      </p>
    </div>
  );
}
