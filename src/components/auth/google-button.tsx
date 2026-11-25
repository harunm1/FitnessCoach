"use client";

import { useState } from "react";
import styles from "./account.module.css";
import { authClient } from "@/lib/auth/client";

// Light theme of Google's "Sign in with Google" branding guidelines (D32): white fill,
// 1 px #747775 stroke, #1F1F1F text, the unmodified colour G, 12 / 10 / 12 px padding.
export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/account",
        errorCallbackURL: "/sign-in?provider=google",
      });
      if (result?.error) throw new Error(result.error.message);
      // On success the browser is already being sent to Google.
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className={styles.googleBlock}>
      <button
        type="button"
        className={styles.googleButton}
        onClick={start}
        disabled={pending}
        aria-busy={pending}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed brand asset, never resized */}
        <img
          src="/brand/google-g.png"
          alt=""
          width={20}
          height={20}
          className={styles.googleMark}
        />
        <span>Continue with Google</span>
      </button>
      {failed && (
        <p
          role="alert"
          className={[styles.notice, styles.errorNotice].join(" ")}
        >
          <span>We couldn&apos;t reach Google. Please try again.</span>
        </p>
      )}
    </div>
  );
}
