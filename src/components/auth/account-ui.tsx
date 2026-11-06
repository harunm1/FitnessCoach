import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./account.module.css";
import { AccountTheme, ThemeToggle } from "./account-theme";

type IconName =
  | "activity"
  | "arrow"
  | "check"
  | "mail"
  | "lock"
  | "eye"
  | "eye-off"
  | "spark"
  | "user"
  | "logout"
  | "shield"
  | "clock";

export function AccountIcon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    activity: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15M13 6l6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "eye-off": (
      <>
        <path d="m3 3 18 18M10 5.2c.7-.1 1.3-.2 2-.2 6.5 0 10 7 10 7a19 19 0 0 1-3 3.8M6.5 6.5A20 20 0 0 0 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M10 10a3 3 0 0 0 4 4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H5v16h5M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

export function AccountBrand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`${styles.brand} ${light ? styles.brandLight : ""}`}
    >
      <span className={styles.brandMark}>
        <AccountIcon name="activity" size={25} />
      </span>
      <span>
        Fitness<span className={styles.brandThin}>Coach</span>
      </span>
    </Link>
  );
}

export function TrainingArtwork() {
  return (
    <svg
      className={styles.trainingArtwork}
      viewBox="0 0 460 270"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="230" cy="205" rx="152" ry="30" stroke="var(--line)" />
      <g
        transform="rotate(-18 230 133)"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect
          x="92"
          y="123"
          width="276"
          height="18"
          rx="6"
          fill="var(--art-handle)"
        />
        <rect
          x="122"
          y="88"
          width="27"
          height="89"
          rx="5"
          fill="var(--art-plate)"
        />
        <rect
          x="152"
          y="70"
          width="34"
          height="125"
          rx="5"
          fill="var(--subtle)"
        />
        <path d="M163 80v105" strokeOpacity=".4" />
        <rect
          x="274"
          y="70"
          width="34"
          height="125"
          rx="5"
          fill="var(--subtle)"
        />
        <path d="M285 80v105" strokeOpacity=".4" />
        <rect
          x="311"
          y="88"
          width="27"
          height="89"
          rx="5"
          fill="var(--art-plate)"
        />
      </g>
    </svg>
  );
}

export function AuthExperience({
  children,
  recovery = false,
}: {
  children: ReactNode;
  recovery?: boolean;
}) {
  return (
    <AccountTheme className={styles.authPage}>
      <aside className={styles.story} aria-label="Welcome to FitnessCoach">
        <AccountBrand light />
        <div className={styles.storyCopy}>
          <span className={styles.storyEyebrow}>
            <span className={styles.smallDot} /> BUILT AROUND YOU
          </span>
          <h2 className={styles.storyTitle}>
            Build a training routine
            <br />
            <span>that fits you.</span>
          </h2>
          <p className={styles.storyDescription}>
            Personalised fitness coaching, at your own pace.
          </p>
        </div>
        <div className={styles.storyArt}>
          <TrainingArtwork />
          <span className={styles.artCaption}>YOUR TRAINING. YOUR PACE.</span>
        </div>
        <div className={styles.storyBottom}>
          <span className={styles.storyBottomIcon}>
            <AccountIcon name={recovery ? "shield" : "spark"} />
          </span>
          <div>
            <strong>
              {recovery
                ? "A secure way back."
                : "A routine worth returning to."}
            </strong>
            <p>
              {recovery
                ? "Verification and reset links expire after one hour."
                : "Get started with a verified account."}
            </p>
          </div>
        </div>
      </aside>
      <div className={styles.authContent}>
        <div className={styles.authToolbar}>
          <ThemeToggle />
        </div>
        {children}
        <p className={styles.authFooter}>
          <AccountIcon name="shield" size={15} /> Verified email. Secure
          sign-in.
        </p>
      </div>
    </AccountTheme>
  );
}
