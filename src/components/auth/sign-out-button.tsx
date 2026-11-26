"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { AccountIcon } from "./account-ui";
import styles from "./account.module.css";

const ICON_SIZE = 20;
const LABELLED_ICON_SIZE = 16;

// "icon" is the sidebar's one-click sign-out: just the icon, with the same
// accessible name. "button" is the labelled button.
export function SignOutButton({
  variant = "button",
}: {
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={variant === "icon" ? styles.signOutIconWrap : undefined}>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className={
          variant === "icon" ? styles.signOutIcon : styles.signOutButton
        }
        aria-label={pending ? "Signing out…" : "Sign out"}
        title="Sign out"
      >
        <AccountIcon
          name="logout"
          size={variant === "icon" ? ICON_SIZE : LABELLED_ICON_SIZE}
        />
        {variant === "button" && (
          <span className={styles.signOutLabel}>
            {pending ? "Signing out…" : "Sign out"}
          </span>
        )}
      </button>
      {error && (
        <p
          role="alert"
          className={
            variant === "icon" ? styles.signOutIconError : styles.signOutError
          }
        >
          {error}
        </p>
      )}
    </div>
  );
}
