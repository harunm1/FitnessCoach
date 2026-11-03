import { AuthForm } from "@/components/auth/auth-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="sign-in"
      verified={params.verified === "1" && !params.error}
      verificationError={Boolean(params.error)}
    />
  );
}
