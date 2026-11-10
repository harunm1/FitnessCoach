import { AuthForm } from "@/components/auth/auth-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthForm mode="verify-email" verificationError={Boolean(params.error)} />
  );
}
