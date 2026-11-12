import { Suspense } from "react";
import { BillingPanel } from "@/components/auth/billing-panel";
import { requireAccount } from "@/lib/auth/access";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TrialButton } from "@/components/auth/trial-button";
import { AccountBrand, AccountIcon } from "@/components/auth/account-ui";
import styles from "@/components/auth/account.module.css";
import { AccountTheme, ThemeToggle } from "@/components/auth/account-theme";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { ProfilePhotoForm } from "@/components/auth/profile-photo-form";
import { loadAvatar } from "@/lib/photos/avatar";

// A request-time display snapshot; permission checks remain in the server guard.
function trialDaysRemaining(endsAt: Date | null, active: boolean) {
  return active && endsAt
    ? Math.max(0, Math.min(7, (endsAt.getTime() - Date.now()) / 86_400_000))
    : 0;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; billing?: string }>;
}) {
  const { user, access } = await requireAccount();
  const params = await searchParams;
  const avatar = await loadAvatar(user.id);
  const firstName = user.name.trim().split(/\s+/)[0] || "athlete";
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase() || "FC";
  const coachEnabled = access.permissions.includes("coach");
  const adminEnabled = access.permissions.includes("manage-content");
  const remainingDays = trialDaysRemaining(
    access.trialEndsAt,
    access.activeTrial,
  );
  const trialTitle = access.canStartTrial
    ? "Try the coach for 7 days."
    : access.activeTrial
      ? "Make the most of your trial."
      : adminEnabled
        ? "Your admin account."
        : coachEnabled
          ? "Coach access, included."
          : "Your free training access.";
  const trialDescription = access.canStartTrial
    ? "Explore coach access with a one-time free trial. Start when you’re ready, with no card required."
    : access.activeTrial
      ? "Your coach access is active. Take it one session at a time and find what works for you."
      : adminEnabled
        ? "Your account includes coach and content management permissions."
        : coachEnabled
          ? "Your PRO account includes coach access, alongside your free training features."
          : "Your free training features remain available after your trial ends.";

  return (
    <AccountTheme className={styles.accountPage}>
      <header className={styles.accountHeader}>
        <AccountBrand />
        <div className={styles.headerRight}>
          <ThemeToggle />
          <span className={styles.headerLabel}>
            <AccountIcon name="shield" size={16} /> Verified account
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className={styles.accountContent}>
        <div className={styles.accountIntro}>
          <div>
            <p className={styles.eyebrow}>ACCOUNT OVERVIEW</p>
            <h1 className={styles.accountTitle}>Your account</h1>
            <p className={styles.introText}>Welcome back, {firstName}.</p>
          </div>
          <span className={styles.readyBadge}>
            <AccountIcon name="check" size={14} /> Account active
          </span>
        </div>
        {params.access === "required" && (
          <p
            role="alert"
            className={[styles.notice, styles.errorNotice].join(" ")}
          >
            <AccountIcon name="lock" size={18} /> Your account does not have
            access to that feature. Check your access below.
          </p>
        )}
        <div className={styles.dashboardGrid}>
          <div className={styles.mainColumn}>
            <section aria-labelledby="trial-title" className={styles.trialCard}>
              <div className={styles.trialTop}>
                <span className={styles.trialIcon}>
                  <AccountIcon name="spark" size={23} />
                </span>
                <p className={styles.tierPill}>
                  Current tier: {access.effectiveTier}
                </p>
              </div>
              <h2 id="trial-title" className={styles.trialTitle}>
                {trialTitle}
              </h2>
              <p className={styles.trialDescription}>{trialDescription}</p>
              {access.canStartTrial && (
                <>
                  <div className={styles.trialPerks}>
                    <span>
                      <AccountIcon name="check" size={14} /> 7 days of coach
                      access
                    </span>
                    <span>
                      <AccountIcon name="check" size={14} /> No card required
                    </span>
                  </div>
                  <TrialButton />
                  <p className={styles.trialFinePrint}>
                    Starts when you’re ready. Ends automatically, with no
                    charge.
                  </p>
                </>
              )}
              {access.activeTrial && access.trialEndsAt && (
                <>
                  <p role="status" className={styles.trialStatus}>
                    Your free trial is active until{" "}
                    <time dateTime={access.trialEndsAt.toISOString()}>
                      {access.trialEndsAt.toUTCString()}
                    </time>
                    .
                  </p>
                  <progress
                    className={styles.trialMeter}
                    max={7}
                    value={remainingDays}
                    aria-label="Trial time remaining"
                  />
                  <p className={styles.trialRemaining}>
                    {Math.ceil(remainingDays)}{" "}
                    {Math.ceil(remainingDays) === 1 ? "day" : "days"} remaining
                    · No automatic charge
                  </p>
                </>
              )}
              {access.effectiveTier === "FREE" && !access.canStartTrial && (
                <p className={styles.trialStatus}>
                  A new trial is unavailable. Free features remain available.
                </p>
              )}
            </section>
            {!adminEnabled && (
              <Suspense
                fallback={
                  <section
                    className={styles.card}
                    aria-label="Loading membership"
                  >
                    Loading membership…
                  </section>
                }
              >
                <BillingPanel userId={user.id} returned={params.billing} />
              </Suspense>
            )}
            <section className={styles.card} aria-labelledby="access-heading">
              <div className={styles.cardHeading}>
                <h2 id="access-heading" className={styles.cardTitle}>
                  Your access
                </h2>
                <span className={styles.cardIcon}>
                  <AccountIcon name="shield" size={19} />
                </span>
              </div>
              <div className={styles.accessList}>
                <div className={styles.accessRow}>
                  <span className={styles.featureIcon}>
                    <AccountIcon name="activity" size={19} />
                  </span>
                  <div className={styles.accessText}>
                    <strong>Your training essentials</strong>
                    <p>Quiz, default plans and workout tracking</p>
                  </div>
                  <span className={styles.accessCheck} aria-label="Included">
                    <AccountIcon name="check" size={14} />
                  </span>
                </div>
                <div className={styles.accessRow}>
                  <span className={styles.featureIcon}>
                    <AccountIcon name="spark" size={19} />
                  </span>
                  <div className={styles.accessText}>
                    <strong>
                      Coach access: {coachEnabled ? "Enabled" : "Not active"}
                    </strong>
                    <p>
                      {coachEnabled
                        ? "Included with your current access"
                        : access.canStartTrial
                          ? "Available with your free trial"
                          : "Your free training features remain available"}
                    </p>
                  </div>
                  <span
                    className={
                      coachEnabled ? styles.accessCheck : styles.accessLock
                    }
                    aria-hidden="true"
                  >
                    <AccountIcon
                      name={coachEnabled ? "check" : "lock"}
                      size={16}
                    />
                  </span>
                </div>
                {adminEnabled && (
                  <div className={styles.accessRow}>
                    <span className={styles.featureIcon}>
                      <AccountIcon name="shield" size={19} />
                    </span>
                    <div className={styles.accessText}>
                      <strong>Content management access: Enabled</strong>
                      <p>Manage app content with your admin permissions</p>
                    </div>
                    <span className={styles.accessCheck}>
                      <AccountIcon name="check" size={14} />
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
          <div>
            <section className={styles.card} aria-labelledby="profile-heading">
              <div className={styles.profileTop}>
                {avatar ? (
                  // Signed links expire, so the image optimizer can't cache them.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar.url} alt="" className={styles.avatarPhoto} />
                ) : (
                  <span className={styles.avatar} aria-hidden="true">
                    {initials}
                  </span>
                )}
                <div>
                  <h2 id="profile-heading" className={styles.cardTitle}>
                    Your profile
                  </h2>
                  <p>Your account details</p>
                </div>
              </div>
              <ProfilePhotoForm
                hasPhoto={avatar !== null}
                editUrl={avatar?.editUrl ?? null}
              />
              <dl className={styles.profileList}>
                <div>
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Email status</dt>
                  <dd>
                    <span className={styles.verifiedLabel}>
                      <AccountIcon name="check" size={15} /> Verified
                    </span>
                  </dd>
                </div>
              </dl>
              <div className={styles.securityBox}>
                <h3 className={styles.cardTitle}>A secure foundation</h3>
                <p>
                  Update your password using your current password while staying
                  signed in.
                </p>
                <ChangePasswordDialog />
              </div>
            </section>
          </div>
        </div>
        <footer className={styles.accountFooter}>
          <span>
            <AccountIcon name="activity" size={15} /> FitnessCoach
          </span>
          <span>
            <AccountIcon name="shield" size={14} /> Signed in securely
          </span>
        </footer>
      </div>
    </AccountTheme>
  );
}
