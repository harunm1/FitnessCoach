import type { ReactNode } from "react";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";

// The frame of every history page (D28): the app theme, the nav bar, a small label
// and the page title. No nav item is marked current: History has no menu entry yet.
export function HistoryShell({
  name,
  avatarUrl,
  eyebrow,
  title,
  children,
}: {
  name: string;
  avatarUrl: string | null;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className={`mx-auto max-w-3xl ${theme.readablePage}`}>
        <AppNav name={name} avatarUrl={avatarUrl} />
        <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 mb-8 text-3xl font-semibold sm:text-4xl">
          {title}
        </h1>
        {children}
      </div>
    </AccountTheme>
  );
}
