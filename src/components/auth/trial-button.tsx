"use client";

import { useActionState } from "react";
import { startTrial, type TrialState } from "@/app/account/actions";
import { AccountIcon } from "./account-ui";
import styles from "./account.module.css";

export function TrialButton() {
  const [state, action, pending] = useActionState<TrialState>(startTrial, {
    status: "idle",
  });
  return (
    <form action={action} className={styles.trialForm}>
      <button
        type="submit"
        disabled={pending || state.status === "started"}
        className={[styles.primaryButton, styles.trialAction].join(" ")}
      >
        {pending ? "Starting trial…" : "Start free trial"}
        {!pending && <AccountIcon name="arrow" size={17} />}
      </button>
      {state.status === "error" && (
        <p role="alert" className={styles.trialFormError}>
          Couldn’t start your trial. Please try again.
        </p>
      )}
      {state.status === "unavailable" && (
        <p role="status" className={styles.trialFormStatus}>
          A new trial is unavailable. Refresh to see your current access.
        </p>
      )}
    </form>
  );
}
