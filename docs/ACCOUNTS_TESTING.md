# Accounts acceptance checks

Use an ordinary verified test account and a separate admin fixture. Local email
links are read in Mailpit. Use only sandbox keys/cards for billing. Optional local
tier logins are described in [QUIZ_SESSION_AUTH.md](QUIZ_SESSION_AUTH.md).
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
contains startup steps; [ACCOUNTS.md](ACCOUNTS.md#automated-checks) contains isolated
PostgreSQL test commands.

Exercise-coach requests without a verified session must redirect to `/sign-in`
before model setup or chat writes. Two signed-in users asking about the same
exercise and muscle must receive separate histories, including when one request
supplies the other user's ID, conversation ID or previous turns. The PostgreSQL
quiz/session integration suite checks both the returned history and the messages
sent to the mocked model.
Exercise chat also requires an active trial, effective PRO or ADMIN tier. FREE,
expired trials and PRO labels without paid entitlement must not call the model.
The [coach-access guide](COACH_ACCESS.md) covers database-backed reservations and
the remaining caller integrations.

## Milestone 1: account and session

| Check                                                                  | Expected outcome                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Register valid account                                                 | FREE account; hashed password; verification email; no automatic login.                                     |
| Invalid email/name or short/mismatched password                        | Actionable validation; no successful registration.                                                         |
| Sign in before verification                                            | Denied; resend path available.                                                                             |
| Resend verification                                                    | New link captured; user remains signed out.                                                                |
| Verify valid link                                                      | Email verified; sign-in allowed.                                                                           |
| Invalid/expired verification link                                      | No verification; actionable resend path.                                                                   |
| Correct/wrong sign-in password                                         | Correct password reaches account; wrong password does not.                                                 |
| Signed-out `/account` access                                           | Redirect to sign-in.                                                                                       |
| Forgot password for existing/missing email                             | Generic response; recovery message only for an eligible account.                                           |
| Valid password reset                                                   | New password works; old password and old sessions stop working.                                            |
| Reused/expired reset token                                             | No credential change; request another link.                                                                |
| Signed-in Change password                                              | Dialog contains current/new/confirm; successful change keeps current session and revokes other sessions.   |
| Wrong current password or mismatched confirmation                      | No credential change; dialog explains correction.                                                          |
| Session expires before/during password change                          | Sign-in required; no unauthorized update.                                                                  |
| Sign out                                                               | Session invalidated; protected page cannot be reopened authenticated.                                      |
| Cross-origin mutation, forged tier/owner or repeated excessive sign-in | Rejected or rate-limited; no privilege escalation.                                                         |
| Keyboard/mobile/theme                                                  | Labels, focus, dialog cancel and password visibility work; no horizontal overflow at 320px in both themes. |

## Signed-in quiz and session (Issue #50)

| Check                                                                       | Expected outcome                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Open `/onboarding` or `/session` without signing in                         | Redirect to `/sign-in` before protected data is read.                                        |
| Call any quiz/session action without a session, including with invalid data | Redirect to `/sign-in`; no mutation occurs.                                                  |
| Revoke a session and submit again                                           | The action requires sign-in again.                                                           |
| Sign in as A while B has a plan/workout                                     | Only A's plan and logs are visible; B's records stay unchanged.                              |
| Submit B's owner/workout IDs or a private exercise from B's plan            | IDs cannot redirect A's writes to B; the private exercise is rejected.                       |
| Complete the quiz, log sets/run metrics and finish as a FREE user           | The core flow works without Stripe or model keys.                                            |
| Opt into local demo logins and rerun the seed                               | All initial tiers can sign in; existing passwords, trial markers and progress are preserved. |

See [QUIZ_SESSION_AUTH.md](QUIZ_SESSION_AUTH.md) for setup and the offline PRO
fixture's limits.

## Milestone 2: trial and permissions

| Check                              | Expected outcome                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| New FREE account                   | Quiz/default-plan/tracking permissions; no coach/admin permission.                    |
| Start free trial                   | Exactly seven days from user activation, no card and no automatic charge.             |
| Repeat/concurrent activation       | One activation only; expiry never extends.                                            |
| Expired trial                      | Effective FREE permissions on the next protected request.                             |
| Trial already used after downgrade | Another trial is unavailable; original marker remains.                                |
| PRO payment/cancellation           | Fresh database permissions apply without a new login.                                 |
| Admin bootstrap                    | Only an existing verified password account can be promoted with the operator command. |
| ADMIN billing events               | ADMIN remains ADMIN.                                                                  |
| Another user's requests            | Reads and writes stay scoped to the authenticated owner.                              |

The account page reports permissions. Feature owners must enforce the shared
server guards on their own pages, actions and handlers when those features merge;
UI labels alone do not prove whole-project authorization.

## Milestone 3: Stripe sandbox

Use the same sandbox for both prices, CLI listener, key and portal. The project
currently uses CAD 10/month and CAD 100/year; annual billing charges the full
annual amount upfront. Hosted Checkout remains authoritative for the final total.
Use Stripe's [official test cards](https://docs.stripe.com/testing), such as
4242 4242 4242 4242 with a future expiry and any three-digit CVC.

| Check                                                       | Expected outcome                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Select Monthly/Yearly                                       | Correct server price appears at Checkout; arbitrary IDs/intervals are rejected.                                            |
| Cancel Checkout                                             | No PRO grant and no change to existing access.                                                                             |
| Repeated same-option request                                | Reuses open Checkout; one customer/session for concurrent clicks.                                                          |
| Change an unpaid Checkout to the other interval             | Prior open session expires before a new one is issued.                                                                     |
| Existing active/pending subscription chooses another option | Goes to Manage billing; no second paid subscription or implicit plan switch.                                               |
| Complete monthly or yearly payment                          | Verified active paid invoice grants PRO; account refreshes automatically.                                                  |
| Forged `?billing=success`                                   | No access without server payment verification.                                                                             |
| Delayed payment confirmation                                | Brief bounded retries; safe message and manual refresh if still pending.                                                   |
| Pricing fails or a configured price is archived             | Existing subscriber retains visible status, paid deadline and management/refresh controls; no unverified access extension. |
| Portal cancellation at period end                           | Cancellation notice; PRO remains through paid expiry.                                                                      |
| Immediate Dashboard cancellation of a disposable fixture    | Remaining original TRIAL or FREE after reconciliation.                                                                     |
| Paid expiry without another webhook                         | Server guard denies PRO after the verified deadline.                                                                       |
| Renewal paid / failed / recovered                           | Paid date extends / PRO falls back / PRO returns after a verified paid state.                                              |
| Duplicate or stale event                                    | Current Stripe state wins; event processed once; a failed transaction remains retryable.                                   |
| Missing/invalid signature, stale signature or live event    | HTTP 400; no entitlement changes.                                                                                          |
| Unknown customer or unrelated signed event                  | Acknowledged without granting access.                                                                                      |
| ADMIN or second user                                        | No unintended role/access changes.                                                                                         |

## Renewal, failure and cancellation simulations

Use [Stripe Billing test clocks](https://docs.stripe.com/billing/testing) on
**disposable fixture customers**, not an existing user's subscription. A clock
must be associated with the customer before creating its subscription. Advance
past the period boundary, wait for the simulation and invoice processing to
finish, then compare Stripe status and the app's reconciled paid deadline.

Test payment failure with the payment methods/scenarios in Stripe's current
Billing testing guide. Restore a working test method and pay the fixture invoice
to verify recovery. Verify the portal is set to period-end cancellation before
using it; an immediate-cancellation setting produces different behavior.

The CLI forwards newly generated sandbox events locally. Dashboard resend is
available for registered webhook endpoints; a CLI-only listener is not a public
Dashboard endpoint. Do not assume `stripe trigger` fixtures belong to an app
user: unknown customers intentionally grant nothing. Transactional duplicate,
stale-event and retry cases are covered by the offline integration suite.

## What the checks establish

- Unit tests cover configuration, invoice interpretation, price selection,
  Checkout-return retries and membership markup/error states.
- PostgreSQL integration tests exercise authentication, ownership, concurrency,
  tiers, cancellation, failure, duplicate events and recovery with injected
  Stripe responses. They never submit a payment.
- Browser tests exercise actual account pages, email links, sessions, responsive
  themes, password dialogs and tier refresh against an isolated database/inbox.
  They explicitly clear Stripe credentials from their app server environment.
- Hosted Checkout, portal interactions and real sandbox clock behavior require
  provider verification in addition to those offline tests. Record actual
  outcomes instead of treating simulated responses as hosted-payment proof.

A clean review runs formatting, lint, TypeScript, unit tests, isolated integration
tests, build and Chromium tests. Test artifacts and credentials stay out of Git.

## Completion verification record

The completion pass ran the existing 15-test browser suite, the unit suite and
isolated PostgreSQL suite. Additional disposable Stripe sandbox fixtures verified:

- Both configured billing options rendered and were selectable at 320px in light
  and dark themes; the created real Checkout sessions contained the selected price.
- Changing an unpaid annual Checkout to monthly expired the previous session.
- Actual paid monthly and annual invoices granted PRO through the real gateway.
- Period-end cancellation retained paid access; immediate fixture cancellation
  removed it after reconciliation.
- A real Stripe test clock produced a renewal that extended the paid deadline.
  Fixture invoices were finalized/paid through the API where needed for deterministic
  verification. A subsequent failing test method removed PRO; paying the fixture
  invoice with a working test method restored it.

Fixtures used an isolated `_test` database and were cleaned up. Existing development
subscriptions were not changed. The configured-browser check verified hosted-session
creation and selection; it did not enter card details in the hosted annual form or
exercise the portal's interactive cancellation UI. Those final user-facing checks
remain in the manual matrix above. This record describes observed behavior for this
pass, not a guarantee about later changes or real email-provider delivery.
