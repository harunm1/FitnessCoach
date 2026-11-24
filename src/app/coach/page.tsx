// The coach screen (#63): the signed-in user's saved conversation and the message box, or the tier or quiz message.
import Link from "next/link";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import { requireAccount } from "@/lib/auth/access";
import {
  hasProfile,
  loadConversation,
  type StoredMessage,
} from "@/lib/coach/conversation";
import { loadAvatarUrl } from "@/lib/photos/avatar";
import { prisma } from "@/lib/prisma";
import CoachForm from "./CoachForm";
import MessageList from "./MessageList";
import { NO_PROFILE_MESSAGE, TIER_MESSAGE } from "./copy";

// Always the current conversation, never a build-time copy (FE-26).
export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { user, access } = await requireAccount();
  const canChat = access.permissions.includes("coach");
  // Started now so the photo link loads alongside the conversation.
  const avatar = loadAvatarUrl(user.id);
  const [profile, conversation] = canChat
    ? await Promise.all([
        hasProfile(prisma, user.id),
        loadConversation(prisma, user.id),
      ])
    : [false, null];
  const avatarUrl = await avatar;

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className={`mx-auto max-w-7xl ${theme.readablePage}`}>
        <AppNav current="coach" name={user.name} avatarUrl={avatarUrl} />
        <h1 className="text-3xl font-semibold">Coach</h1>
        <CoachBody
          canChat={canChat}
          hasProfile={profile}
          messages={conversation?.messages ?? []}
        />
      </div>
    </AccountTheme>
  );
}

type CoachBodyProps = {
  canChat: boolean;
  hasProfile: boolean;
  messages: StoredMessage[];
};

// Tier first, then the quiz, then the chat.
function CoachBody({ canChat, hasProfile, messages }: CoachBodyProps) {
  if (!canChat) {
    return (
      <Notice href="/account" link="Go to your account" text={TIER_MESSAGE} />
    );
  }
  if (!hasProfile) {
    return (
      <Notice
        href="/onboarding"
        link="Take the quiz"
        text={NO_PROFILE_MESSAGE}
      />
    );
  }
  return <Chat messages={messages} />;
}

type NoticeProps = { text: string; href: string; link: string };

function Notice({ text, href, link }: NoticeProps) {
  return (
    <p className="mt-4 text-sm leading-6">
      {text}{" "}
      <Link className="underline" href={href}>
        {link}
      </Link>
    </p>
  );
}

function Chat({ messages }: { messages: StoredMessage[] }) {
  return (
    <>
      <p className="mt-2 mb-6 text-sm leading-6 text-foreground/70">
        Ask about today&apos;s session, a swap, or how hard to push. The coach
        knows your plan and your equipment.
      </p>
      <MessageList messages={messages} />
      <CoachForm />
    </>
  );
}
