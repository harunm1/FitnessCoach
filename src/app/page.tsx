import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

// Landing page; the reference screen for the shadcn/ui components (D17 in docs/ARCHITECTURE.md).
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
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
          {/* A link styled as a button, as in Lecture 8: buttonVariants on next/link. */}
          <Link
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
            href="/onboarding"
          >
            Start your quiz
          </Link>
          {/* Account links from #67, kept beside the quiz link. */}
          <div className="flex gap-6 text-sm">
            <Link className="underline underline-offset-4" href="/sign-up">
              Create account
            </Link>
            <Link className="underline underline-offset-4" href="/sign-in">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
