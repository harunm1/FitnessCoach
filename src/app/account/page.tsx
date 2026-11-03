import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/" className="text-xl font-bold">
        FitnessCoach
      </Link>
      <h1 className="mt-10 text-3xl font-semibold">Your account</h1>
      <p className="mt-3">
        Welcome back, {user.name}. Your account is ready for training.
      </p>
      <dl className="my-8 space-y-4 rounded-xl border border-current/15 p-6">
        <div>
          <dt className="text-sm opacity-70">Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt className="text-sm opacity-70">Email</dt>
          <dd className="break-all">{user.email}</dd>
        </div>
        <div>
          <dt className="text-sm opacity-70">Email status</dt>
          <dd>Verified</dd>
        </div>
      </dl>
      <SignOutButton />
    </main>
  );
}
