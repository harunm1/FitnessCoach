"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { passwordSchema } from "@/lib/auth/validation";
import { AccountIcon } from "./account-ui";
import styles from "./account.module.css";

const fields = [
  {
    name: "currentPassword",
    label: "Current password",
    autocomplete: "current-password",
    minLength: 1,
  },
  {
    name: "newPassword",
    label: "New password",
    autocomplete: "new-password",
    minLength: 12,
  },
  {
    name: "confirmation",
    label: "Confirm new password",
    autocomplete: "new-password",
    minLength: 12,
  },
] as const;

export function ChangePasswordDialog() {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [invalidField, setInvalidField] = useState("");

  useEffect(() => {
    if (!dialog.current?.open) return;
    if (success) done.current?.focus();
    else if (!checking) {
      const input = form.current?.elements.namedItem("currentPassword");
      if (input instanceof HTMLInputElement) input.focus();
    }
  }, [success, checking]);

  useEffect(() => {
    if (!pending && invalidField) {
      const input = form.current?.elements.namedItem(invalidField);
      if (input instanceof HTMLInputElement) input.focus();
    }
  }, [invalidField, pending]);

  function expiredSession() {
    form.current?.reset();
    dialog.current?.close();
    router.replace("/sign-in?reason=session-expired");
    router.refresh();
  }

  async function open() {
    if (checking) return;
    setChecking(true);
    setLaunchError("");
    try {
      const result = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if (result.error) {
        if (result.error.status === 401) expiredSession();
        else setLaunchError("Couldn’t check your session. Please try again.");
        return;
      }
      if (!result.data?.user.emailVerified) {
        expiredSession();
        return;
      }
      form.current?.reset();
      setError("");
      setSuccess(false);
      setShowPasswords(false);
      setInvalidField("");
      dialog.current?.showModal();
      const input = form.current?.elements.namedItem("currentPassword");
      if (input instanceof HTMLInputElement) input.focus();
    } catch {
      setLaunchError("Couldn’t check your session. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function focusField(name: string) {
    setInvalidField(name);
    const input = form.current?.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setInvalidField("");
    const values = new FormData(event.currentTarget);
    const currentPassword = String(values.get("currentPassword") ?? "");
    const newPassword = String(values.get("newPassword") ?? "");
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your new password.");
      focusField("newPassword");
      return;
    }
    if (newPassword !== values.get("confirmation")) {
      setError("New passwords must match.");
      focusField("confirmation");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        if (result.error.status === 401) {
          expiredSession();
        } else if (result.error.code === "INVALID_PASSWORD") {
          setError("Your current password is incorrect.");
          setPending(false);
          focusField("currentPassword");
        } else if (result.error.status === 429) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError("Couldn’t change your password. Please try again.");
        }
        return;
      }
      form.current?.reset();
      setShowPasswords(false);
      setSuccess(true);
    } catch {
      setError("Couldn’t reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function closed() {
    form.current?.reset();
    setShowPasswords(false);
    setError("");
    setInvalidField("");
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div>
      <button
        ref={trigger}
        type="button"
        className={styles.changePasswordButton}
        onClick={open}
        disabled={checking}
        aria-haspopup="dialog"
        aria-controls={id}
      >
        <AccountIcon name="lock" size={15} />{" "}
        {checking ? "Checking session…" : "Change password"}{" "}
        <AccountIcon name="arrow" size={14} />
      </button>
      {launchError && (
        <p role="alert" className={styles.fieldError}>
          {launchError}
        </p>
      )}
      <dialog
        ref={dialog}
        id={id}
        className={styles.passwordDialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={closed}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), a[href]",
            ),
          ).filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first && last) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === last &&
            first
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={(event) => {
          if (pending || event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.currentTarget.close();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id={`${id}-title`} className={styles.dialogTitle}>
            Change password
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            aria-label="Close change password"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <p id={`${id}-description`} className={styles.dialogDescription}>
          Update your password here. You’ll stay signed in on this device; other
          existing sessions will be signed out.
        </p>
        {success ? (
          <div>
            <p
              role="status"
              className={[styles.notice, styles.successNotice].join(" ")}
            >
              <AccountIcon name="check" size={18} />
              <span>
                Password updated. You’re still signed in on this device.
              </span>
            </p>
            <button
              ref={done}
              type="button"
              className={styles.primaryButton}
              onClick={() => dialog.current?.close()}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            ref={form}
            method="post"
            className={styles.passwordChangeForm}
            onSubmit={submit}
            aria-busy={pending}
          >
            {fields.map((field) => (
              <div key={field.name} className={styles.field}>
                <label className={styles.label} htmlFor={`${id}-${field.name}`}>
                  {field.label}
                </label>
                <input
                  className={styles.dialogInput}
                  id={`${id}-${field.name}`}
                  name={field.name}
                  type={showPasswords ? "text" : "password"}
                  autoComplete={field.autocomplete}
                  required
                  minLength={field.minLength}
                  maxLength={128}
                  disabled={pending}
                  aria-invalid={invalidField === field.name || undefined}
                  aria-describedby={
                    invalidField === field.name
                      ? `${id}-error`
                      : field.name === "newPassword"
                        ? `${id}-hint`
                        : undefined
                  }
                />
                {field.name === "newPassword" && (
                  <p id={`${id}-hint`} className={styles.fieldHint}>
                    Use 12–128 characters.
                  </p>
                )}
              </div>
            ))}
            <label className={styles.showPasswordLabel}>
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(event) => setShowPasswords(event.target.checked)}
                disabled={pending}
              />{" "}
              Show passwords
            </label>
            {error && (
              <p
                id={`${id}-error`}
                role="alert"
                className={[styles.notice, styles.errorNotice].join(" ")}
              >
                {error}
              </p>
            )}
            <Link href="/forgot-password" className={styles.textLink}>
              Forgot your current password?
            </Link>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                disabled={pending}
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={pending}
              >
                {pending ? "Updating password…" : "Save password"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
