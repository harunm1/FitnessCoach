// The coach screen (#63): the signed-in user's saved conversation and the message box, or the tier message.
import Link from "next/link";
import { requireAccount } from "@/lib/auth/access";
import { loadConversation } from "@/lib/coach/conversation";
import { prisma } from "@/lib/prisma";
import CoachForm from "./CoachForm";
import MessageList from "./MessageList";
import { TIER_MESSAGE } from "./copy";

// Always the current conversation, never a build-time copy (FE-26).
export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { user, access } = await requireAccount();
  const canChat = access.permissions.includes("coach");
  const conversation = canChat ? await loadConversation(prisma, user.id) : null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link className="text-sm underline" href="/session">
          Back to today&apos;s session
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Coach</h1>
        {canChat ? (
          <>
            <p className="mt-2 mb-6 text-sm leading-6 text-foreground/70">
              Ask about today&apos;s session, a swap, or how hard to push. The
              coach knows your plan and your equipment.
            </p>
            <MessageList messages={conversation?.messages ?? []} />
            <CoachForm />
          </>
        ) : (
          <p className="mt-4 text-sm leading-6">
            {TIER_MESSAGE}{" "}
            <Link className="underline" href="/account">
              Go to your account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
