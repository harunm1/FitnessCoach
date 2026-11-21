import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";
import { AccountTheme, ThemeToggle } from "@/components/auth/account-theme";
import theme from "@/components/theme/app-theme.module.css";
import { getVerifiedUser } from "@/lib/auth/session";

// Landing page; the reference screen for the shadcn/ui components (D20 in docs/ARCHITECTURE.md).
// Signed-in users go straight to their session, which sends them to the quiz
// first if they haven't taken it, so the logo always lands somewhere useful.
export default async function Home() {
  if (await getVerifiedUser()) redirect("/session");

  return (
    <AccountTheme
      className={`${theme.appTheme} relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground`}
    >
      {/* The same light and dark switch as the other pages. */}
      <div className="absolute top-5 right-5 max-sm:[&_button>span]:hidden">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>
            <h1 className="text-4xl font-semibold">FORM</h1>
          </CardTitle>
          <CardDescription>
            A fitness coach for a routine that fits your life.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          {/* buttonVariants does not merge Tailwind classes, so cn() lets h-11 and px-5 override the lg size's h-9 and px-2.5. */}
          <Link
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
            href="/sign-up"
          >
            Get started
          </Link>
          {/* Secondary action; Get started above is the primary one. */}
          <div className="flex gap-6 text-sm">
            <Link className="underline underline-offset-4" href="/sign-in">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AccountTheme>
  );
}
