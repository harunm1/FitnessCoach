import { AuthForm } from "@/components/auth/auth-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" && !params.error
      ? params.token
      : undefined;
  return <AuthForm mode="reset-password" token={token} />;
}
