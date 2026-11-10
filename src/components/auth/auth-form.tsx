"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AccountIcon, AuthExperience } from "./account-ui";
import styles from "./account.module.css";
import { authClient } from "@/lib/auth/client";
import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";

type Mode =
  "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "verify-email";
const copy: Record<
  Mode,
  { title: string; description: string; submit: string }
> = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to continue your training.",
    submit: "Sign in",
  },
  "sign-up": {
    title: "Create your account",
    description: "Create your account to get started.",
    submit: "Create account",
  },
  "forgot-password": {
    title: "Reset your password",
    description: "Enter your email to request a password reset link.",
    submit: "Send reset link",
  },
  "reset-password": {
    title: "Choose a new password",
    description: "Use at least 12 characters for your new password.",
    submit: "Save new password",
  },
  "verify-email": {
    title: "Check your email",
    description:
      "Open the verification link in your inbox before signing in. You can request another email below.",
    submit: "Resend verification email",
  },
};

function PasswordField({
  confirmation = false,
  newPassword = false,
  disabled,
  invalid = false,
}: {
  confirmation?: boolean;
  newPassword?: boolean;
  disabled: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const label = confirmation ? "Confirm password" : "Password";
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <span className={styles.inputIcon}>
          <AccountIcon name="lock" size={18} />
        </span>
        <input
          id={id}
          className={`${styles.input} ${styles.passwordInput}`}
          type={visible ? "text" : "password"}
          name={confirmation ? "confirmation" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          minLength={newPassword ? 12 : 1}
          maxLength={128}
          required
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-hint${invalid ? " auth-error" : ""}`}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setVisible(!visible)}
          disabled={disabled}
          aria-label={`${visible ? "Hide" : "Show"} ${confirmation ? "confirm password" : "password"}`}
          aria-pressed={visible}
          aria-controls={id}
        >
          <AccountIcon name={visible ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
      <p id={`${id}-hint`} className={styles.fieldHint}>
        {capsLock
          ? "Caps Lock is on."
          : newPassword && !confirmation
            ? "Use 12–128 characters. A passphrase works well."
            : confirmation
              ? "Enter your password once more."
              : "Your password is case-sensitive."}
      </p>
    </div>
  );
}

export function AuthForm({
  mode,
  token,
  verified = false,
  verificationError = false,
  sessionExpired = false,
}: {
  mode: Mode;
  token?: string;
  verified?: boolean;
  verificationError?: boolean;
  sessionExpired?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    verificationError
      ? "This verification link is invalid or expired. Request a new one below."
      : "",
  );
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode !== "verify-email") return;
    try {
      if (emailInput.current && !emailInput.current.value)
        emailInput.current.value =
          sessionStorage.getItem("fitnesscoach.pendingEmail") ?? "";
    } catch {
      /* The form also works when browser storage is unavailable. */
    }
  }, [mode]);
  const config = copy[mode];
  const hasPassword = ["sign-in", "sign-up", "reset-password"].includes(mode);
  const confirmPassword = mode === "sign-up" || mode === "reset-password";
  const invalidReset = mode === "reset-password" && !token;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
    setInvalidField("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    const parsed =
      mode === "sign-up"
        ? signUpSchema.safeParse({ name, email, password })
        : mode === "sign-in"
          ? signInSchema.safeParse({ email, password })
          : mode === "reset-password"
            ? passwordSchema.safeParse(password)
            : emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form fields.");
      const field = String(
        parsed.error.issues[0]?.path[0] ??
          (mode === "reset-password" ? "password" : "email"),
      );
      setInvalidField(field);
      const input = event.currentTarget.elements.namedItem(field);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    if (confirmPassword && password !== values.get("confirmation")) {
      setError("Passwords must match.");
      setInvalidField("confirmation");
      const input = event.currentTarget.elements.namedItem("confirmation");
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    if (invalidReset) return;
    setPending(true);
    try {
      const origin = window.location.origin;
      const verificationURL = `${origin}/sign-in?verified=1`;
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: verificationURL,
        });
        if (result.error) {
          setError(
            "We couldn't create your account. Check your details and try again.",
          );
          return;
        }
        try {
          sessionStorage.setItem("fitnesscoach.pendingEmail", email);
        } catch {
          /* Optional convenience only. */
        }
        router.replace("/verify-email");
      } else if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          setError(
            result.error.code === "EMAIL_NOT_VERIFIED"
              ? "Verify your email before signing in. You can resend the link below."
              : "Invalid email or password. Please try again.",
          );
          return;
        }
        try {
          sessionStorage.removeItem("fitnesscoach.pendingEmail");
        } catch {
          /* Optional convenience only. */
        }
        router.replace("/account");
        router.refresh();
      } else if (mode === "forgot-password") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${origin}/reset-password`,
        });
        if (result.error) {
          setError("We couldn't send the request. Please try again shortly.");
          return;
        }
        setMessage(
          "If an account exists for this email, you will receive a reset link.",
        );
      } else if (mode === "verify-email") {
        const result = await authClient.sendVerificationEmail({
          email,
          callbackURL: verificationURL,
        });
        if (result.error) {
          setError("We couldn't send the request. Please try again shortly.");
          return;
        }
        setMessage(
          "If your account needs verification, a new link will arrive in your inbox.",
        );
      } else {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: token!,
        });
        if (result.error) {
          setError(
            "This reset link is invalid or expired. Request a new one below.",
          );
          return;
        }
        setMessage(
          "Your password has been reset. Sign in with your new password.",
        );
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthExperience recovery={!["sign-in", "sign-up"].includes(mode)}>
      <section className={styles.formSection} aria-labelledby="auth-title">
        {mode === "sign-in" || mode === "sign-up" ? (
          <nav className={styles.tabs} aria-label="Account access">
            <Link
              href="/sign-in"
              className={[
                styles.tab,
                mode === "sign-in" ? styles.tabActive : "",
              ].join(" ")}
              aria-current={mode === "sign-in" ? "page" : undefined}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={[
                styles.tab,
                mode === "sign-up" ? styles.tabActive : "",
              ].join(" ")}
              aria-current={mode === "sign-up" ? "page" : undefined}
            >
              Create account
            </Link>
          </nav>
        ) : (
          <Link href="/sign-in" className={styles.backLink}>
            <AccountIcon name="arrow" size={16} /> Back to sign in
          </Link>
        )}
        <p className={styles.formEyebrow}>
          <AccountIcon
            name={
              mode === "verify-email"
                ? "mail"
                : mode === "sign-up"
                  ? "spark"
                  : "activity"
            }
            size={15}
          />{" "}
          {mode === "sign-in"
            ? "ACCOUNT ACCESS"
            : mode === "sign-up"
              ? "GET STARTED"
              : "ACCOUNT SUPPORT"}
        </p>
        <h1 id="auth-title" className={styles.formTitle}>
          {config.title}
        </h1>
        <p className={styles.formDescription}>{config.description}</p>
        {sessionExpired && (
          <p
            role="status"
            className={[styles.notice, styles.sessionNotice].join(" ")}
          >
            Your session has expired. Sign in again, or use Forgot password if
            you need to recover your account.
          </p>
        )}
        {verified && (
          <p
            role="status"
            className={[styles.notice, styles.successNotice].join(" ")}
          >
            <AccountIcon name="check" size={18} /> Email verified. You can now
            sign in.
          </p>
        )}
        {invalidReset ? (
          <p
            role="alert"
            className={[styles.notice, styles.errorNotice].join(" ")}
          >
            <AccountIcon name="lock" size={18} /> This reset link is invalid or
            expired. Request a new one below.
          </p>
        ) : (
          <form
            method="post"
            onSubmit={submit}
            className={styles.form}
            aria-busy={pending}
          >
            {mode === "sign-up" && (
              <div className={styles.field}>
                <label htmlFor="auth-name" className={styles.label}>
                  Name
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <AccountIcon name="user" size={18} />
                  </span>
                  <input
                    id="auth-name"
                    className={styles.input}
                    name="name"
                    autoComplete="name"
                    placeholder="Your name"
                    maxLength={100}
                    required
                    disabled={pending}
                    aria-invalid={invalidField === "name" || undefined}
                    aria-describedby={
                      invalidField === "name" ? "auth-error" : undefined
                    }
                  />
                </div>
              </div>
            )}
            {mode !== "reset-password" && (
              <div className={styles.field}>
                <label htmlFor="auth-email" className={styles.label}>
                  Email
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <AccountIcon name="mail" size={18} />
                  </span>
                  <input
                    ref={emailInput}
                    id="auth-email"
                    className={styles.input}
                    type="email"
                    name="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                    maxLength={254}
                    required
                    disabled={pending}
                    aria-invalid={invalidField === "email" || undefined}
                    aria-describedby={
                      invalidField === "email" ? "auth-error" : undefined
                    }
                  />
                </div>
              </div>
            )}
            {hasPassword && (
              <PasswordField
                newPassword={mode !== "sign-in"}
                disabled={pending}
                invalid={invalidField === "password"}
              />
            )}
            {confirmPassword && (
              <PasswordField
                confirmation
                newPassword
                disabled={pending}
                invalid={invalidField === "confirmation"}
              />
            )}
            {mode === "sign-in" && (
              <div className={styles.forgotRow}>
                <Link className={styles.textLink} href="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            )}
            {error && (
              <p
                id="auth-error"
                role="alert"
                className={[styles.notice, styles.errorNotice].join(" ")}
              >
                <AccountIcon name="shield" size={18} />
                <span>{error}</span>
              </p>
            )}
            {message && (
              <p
                role="status"
                className={[styles.notice, styles.successNotice].join(" ")}
              >
                <AccountIcon name="check" size={18} />
                <span>{message}</span>
              </p>
            )}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={
                pending || Boolean(message && mode === "reset-password")
              }
            >
              {pending
                ? mode === "sign-in"
                  ? "Signing in…"
                  : mode === "sign-up"
                    ? "Creating your account…"
                    : "Sending request…"
                : config.submit}
              {!pending && <AccountIcon name="arrow" size={17} />}
            </button>
          </form>
        )}
        {(mode === "verify-email" || mode === "forgot-password") && (
          <div className={styles.mailTip}>
            <AccountIcon name="mail" size={19} />
            <div>
              <strong>A quick inbox check</strong>Can’t find it? Check your spam
              folder and make sure your email is correct. The link expires in
              one hour.
            </div>
          </div>
        )}
        <nav className={styles.authNav} aria-label="Account help">
          {mode === "sign-up" && (
            <>
              <span>Already part of the team?</span>
              <Link href="/sign-in">Sign in</Link>
            </>
          )}
          {mode === "sign-in" && (
            <>
              <span>New here?</span>
              <Link href="/sign-up">Create an account</Link>
              <span aria-hidden="true">·</span>
              <Link href="/verify-email">Resend verification email</Link>
            </>
          )}
          {(mode === "forgot-password" || mode === "verify-email") && (
            <>
              <span>Ready to get moving?</span>
              <Link href="/sign-in">Sign in</Link>
            </>
          )}
          {mode === "reset-password" && (
            <>
              <Link href="/sign-in">Sign in</Link>
              <span aria-hidden="true">·</span>
              <Link href="/forgot-password">Request a new reset link</Link>
            </>
          )}
        </nav>
      </section>
    </AuthExperience>
  );
}
