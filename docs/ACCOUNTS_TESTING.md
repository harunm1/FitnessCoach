# Accounts acceptance checks

Use an ordinary verified test account and a separate admin fixture. Local email
links are read in Mailpit. The seeded
demo user is not a credential account. [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
contains startup steps; [ACCOUNTS.md](ACCOUNTS.md#automated-checks) contains isolated
PostgreSQL test commands.

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

## Milestone 2: trial and permissions

| Check                              | Expected outcome                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| New FREE account                   | Quiz/default-plan/tracking permissions; no coach/admin permission.                    |
| Start free trial                   | Exactly seven days from user activation, no card and no automatic charge.             |
| Repeat/concurrent activation       | One activation only; expiry never extends.                                            |
| Expired trial                      | Effective FREE permissions on the next protected request.                             |
| Trial already used after downgrade | Another trial is unavailable; original marker remains.                                |
| Server-controlled PRO tier         | Fresh database permissions apply on the next protected request.                       |
| Admin bootstrap                    | Only an existing verified password account can be promoted with the operator command. |
| ADMIN tier                         | Coach and content-management access; no public promotion.                             |
| Another user's requests            | Reads and writes stay scoped to the authenticated owner.                              |

The account page reports permissions. Feature owners must enforce the shared
server guards on their own pages, actions and handlers when those features merge;
UI labels alone do not prove whole-project authorization.
