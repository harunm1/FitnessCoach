import Link from "next/link";

// The signed-in user's name with their profile photo, or a person icon
// when they haven't added one. Links to the account page, where they can
// manage their account and sign out.
export function UserBadge({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  return (
    <Link
      href="/account"
      aria-label={`Your account (${name})`}
      className="flex min-h-11 min-w-0 items-center gap-2 hover:opacity-80"
    >
      {imageUrl ? (
        // Signed links expire, so the image optimizer can't cache them.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-8 shrink-0 rounded-full border border-foreground/15 object-cover"
        />
      ) : (
        <span
          data-testid="avatar-icon"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground/60"
        >
          <svg
            viewBox="0 0 24 24"
            width={20}
            height={20}
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
          </svg>
        </span>
      )}
      <span className="truncate text-sm font-medium">{name}</span>
    </Link>
  );
}
