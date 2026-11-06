"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { AccountIcon } from "./account-ui";
import styles from "./account.module.css";

export function SignOutButton() {
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
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className={styles.signOutButton}
        aria-label={pending ? "Signing out…" : "Sign out"}
      >
        <AccountIcon name="logout" size={16} />
        <span className={styles.signOutLabel}>
          {pending ? "Signing out…" : "Sign out"}
        </span>
      </button>
      {error && (
        <p role="alert" className={styles.signOutError}>
          {error}
        </p>
      )}
    </div>
  );
}
