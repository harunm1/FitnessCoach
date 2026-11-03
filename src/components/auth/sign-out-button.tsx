"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

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
        className="rounded-lg bg-foreground px-4 py-2 text-background focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
