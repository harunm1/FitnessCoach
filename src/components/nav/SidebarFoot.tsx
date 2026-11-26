import Link from "next/link";
import { ThemeToggle } from "@/components/auth/account-theme";
import { SignOutButton } from "@/components/auth/sign-out-button";

// First letter of the name, for people without a profile photo.
function initial(name: string) {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

// The foot of the sidebar and of the phone menu: the user's photo and name
// (a link to Settings), a one-click sign-out icon, and the theme toggle.
export function SidebarFoot({
  name,
  avatarUrl,
  current = false,
}: {
  name: string;
  avatarUrl: string | null;
  // True on the account page itself.
  current?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/account"
          aria-current={current ? "page" : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-base font-medium text-[var(--text)] outline-offset-2 hover:bg-[var(--inset)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          {avatarUrl ? (
            // Signed links expire, so the image optimizer can't cache them.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              data-testid="avatar-initial"
              data-initial={initial(name)}
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-base font-semibold text-[var(--brand)] after:content-[attr(data-initial)]"
            />
          )}
          <span className="truncate">{name}</span>
        </Link>
        <SignOutButton variant="icon" />
      </div>
      <ThemeToggle />
    </div>
  );
}
