"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
    description: "Sign in to your FitnessCoach account.",
    submit: "Sign in",
  },
  "sign-up": {
    title: "Create your account",
    description: "Start your training journey with FitnessCoach.",
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

export function AuthForm({
  mode,
  token,
  verified = false,
  verificationError = false,
}: {
  mode: Mode;
  token?: string;
  verified?: boolean;
  verificationError?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    verificationError
      ? "This verification link is invalid or expired. Request a new one below."
      : "",
  );
  const [message, setMessage] = useState("");
  const config = copy[mode];
  const hasPassword = ["sign-in", "sign-up", "reset-password"].includes(mode);
  const confirmPassword = mode === "sign-up" || mode === "reset-password";
  const invalidReset = mode === "reset-password" && !token;
  const inputClass =
    "mt-1 w-full rounded-lg border border-current/25 bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
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
      return;
    }
    if (confirmPassword && password !== values.get("confirmation")) {
      setError("Passwords must match.");
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 text-xl font-bold">
        FitnessCoach
      </Link>
      <section
        className="rounded-2xl border border-current/15 p-6 shadow-sm"
        aria-labelledby="auth-title"
      >
        <h1 id="auth-title" className="text-2xl font-semibold">
          {config.title}
        </h1>
        <p className="mt-2 text-sm opacity-80">{config.description}</p>
        {verified && (
          <p role="status" className="mt-4 text-sm">
            Email verified. You can now sign in.
          </p>
        )}
        {invalidReset ? (
          <p role="alert" className="mt-5">
            This reset link is invalid or expired. Request a new one below.
          </p>
        ) : (
          <form
            method="post"
            onSubmit={submit}
            className="mt-6 space-y-4"
            aria-busy={pending}
          >
            {mode === "sign-up" && (
              <label className="block text-sm font-medium">
                Name
                <input
                  className={inputClass}
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  disabled={pending}
                />
              </label>
            )}
            {mode !== "reset-password" && (
              <label className="block text-sm font-medium">
                Email
                <input
                  className={inputClass}
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={pending}
                />
              </label>
            )}
            {hasPassword && (
              <label className="block text-sm font-medium">
                Password
                <input
                  className={inputClass}
                  type="password"
                  name="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  minLength={mode === "sign-in" ? 1 : 12}
                  maxLength={128}
                  required
                  disabled={pending}
                />
              </label>
            )}
            {confirmPassword && (
              <label className="block text-sm font-medium">
                Confirm password
                <input
                  className={inputClass}
                  type="password"
                  name="confirmation"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={pending}
                />
              </label>
            )}
            {mode === "sign-up" && (
              <p className="text-sm opacity-80">
                Use 12–128 characters. We will email you a verification link.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm">
                {message}
              </p>
            )}
            <button
              className="w-full rounded-lg bg-foreground px-4 py-2.5 font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              type="submit"
              disabled={
                pending || Boolean(message && mode === "reset-password")
              }
            >
              {pending ? "Please wait…" : config.submit}
            </button>
          </form>
        )}
        <nav
          className="mt-6 flex flex-col gap-3 text-sm underline underline-offset-4"
          aria-label="Account help"
        >
          {mode !== "sign-in" && <Link href="/sign-in">Sign in</Link>}
          {mode === "sign-in" && (
            <>
              <Link href="/sign-up">Create an account</Link>
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href="/verify-email">Resend verification email</Link>
            </>
          )}
          {mode === "reset-password" && (
            <Link href="/forgot-password">Request a new reset link</Link>
          )}
        </nav>
      </section>
    </main>
  );
}
