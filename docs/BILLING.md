# Accounts: Stripe test-mode billing (Issue #14, Milestone 3)

Milestone 3 is the last planned accounts milestone. It adds hosted subscription
Checkout, the customer portal and server-side paid-access reconciliation. The
seven-day, user-started, cardless app trial stays separate: subscribing starts a
recurring test subscription immediately, without another trial. Real payments
and live keys are deliberately unsupported.

## Local setup

Follow [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for the complete ordered startup.
[ACCOUNTS_TESTING.md](ACCOUNTS_TESTING.md) covers every acceptance scenario.

Keep your existing private `.env`, database, authentication and SMTP settings.
Do not replace `.env` with the template if you already configured it.

1. Install the new dependency and apply the additive billing migration:

   ```bash
   npm install
   docker compose up -d
   npx prisma migrate deploy
   ```

   This adds `BillingAccount` and `StripeWebhookEvent`; it does not replace user
   accounts or exercise data. Do not reset the database or delete its volume.

2. In a [Stripe sandbox](https://docs.stripe.com/sandboxes), create one
   **FitnessCoach PRO** product with two positive fixed recurring prices: monthly
   and yearly. The current project sandbox uses **CAD 10/month** and **CAD 100/year**.
   Annual billing charges the annual amount upfront. Use the same currency/product;
   licensed per-unit prices with a one-month or one-year interval are supported.
   Copy each `price_...` ID and the sandbox's `sk_test_...` key. Live keys, metered,
   tiered and multi-item subscriptions are unsupported.

3. Configure the sandbox [customer portal](https://docs.stripe.com/customer-management/configure-portal):
   enable payment-method updates, invoice history and cancellation **at the end
   of the billing period**. Disable plan/quantity changes, pause collection,
   coupons and additional trials for this PRO membership integration. Save the
   default portal configuration in the same sandbox as the product and key.

4. Install and authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli),
   then keep this listener running in a separate terminal:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,invoice.paid,invoice.payment_failed,invoice.payment_action_required,invoice.voided,invoice.marked_uncollectible
   ```

   Copy the listener's `whsec_...` signing secret. A Dashboard endpoint secret is
   different from the CLI listener secret. Use snapshot events with API version
   `2026-10-28.endive`, matching the pinned Stripe SDK 23.1.0. For a deployed test
   environment, register its HTTPS webhook URL with those event types/version
   and use that endpoint's secret instead. Use the same sandbox throughout.

5. Add the three values to your private `.env`:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_your_sandbox_key
   STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price
   STRIPE_YEARLY_PRICE_ID=price_your_yearly_price
   # Optional compatibility ID: keep any existing subscription price allowlisted.
   STRIPE_PRICE_ID=price_your_existing_price
   STRIPE_WEBHOOK_SECRET=whsec_your_listener_secret
   ```

   Keep `BETTER_AUTH_URL=http://localhost:3000` when opening the local app at that
   origin. Public origins require HTTPS. No Stripe publishable key is needed:
   payment details are collected on Stripe's hosted page. Restart `npm run dev`
   after changing environment variables. Never commit keys or `.env`.

The period selector appears for accounts eligible to start a subscription. An
existing active/pending subscriber sees management controls instead; choosing
another interval never creates a second subscription. Use a separate FREE test
account to exercise both purchase choices.

Without Stripe settings, signup, verification, login, free access and the
cardless trial remain usable. The membership card explains that subscriptions
are unavailable. No configured amount is invented or hardcoded into the UI.

## Verify with your sandbox

1. Register and verify an ordinary account; sign in and open `/account`. Select
   **Upgrade to PRO (test)**. Confirm Checkout shows the configured product,
   amount, currency and recurring interval for both Monthly and Yearly. Cancel once:
   access must not change.
2. Retry and pay with Stripe's test card `4242 4242 4242 4242`, a future expiry and
   any three-digit CVC. Keep the listener running. After return, the app refreshes
   the subscription from Stripe, briefly retrying if payment is still processing.
   Verified payment automatically refreshes the account tier and coach access
   with the same login. **Refresh billing status** is also available.
   The `?billing=success` parameter alone never grants access.
3. Open **Manage billing**, update the test payment method and cancel at period
   end. Return to the app and verify the cancellation notice and paid-access end
   date. PRO lasts only through the verified paid period. For immediate
   cancellation in the sandbox Dashboard, refresh and expect remaining TRIAL
   access or FREE. Trial dates must never extend.
4. Use [Stripe's Billing test clocks and failure scenarios](https://docs.stripe.com/billing/testing)
   to test renewal, payment failure and recovery. A past-due/unpaid subscription
   loses PRO after reconciliation; there is no extra grace period. A later paid
   renewal restores it. Use a test-clock customer belonging to this app; generic
   `stripe trigger` fixtures with unknown customers intentionally grant nothing.
5. For a registered webhook endpoint, resend an actual event from the sandbox
   Dashboard. CLI-only local forwarding is not a registered public endpoint. Duplicate events
   must succeed without duplicate access changes. Change the subscription and
   resend an older event: the app must use its current Stripe state. A webhook
   with a missing/invalid signature must fail with HTTP 400. Retryable processing
   failures return HTTP 500; resend failed deliveries after correcting setup.
6. Verify a second user's access is unchanged and ADMIN stays ADMIN. Repeated
   clicks must reuse an open Checkout rather than create another subscription.
   An existing active/pending subscription goes to the portal for management.

Use only [official test cards](https://docs.stripe.com/testing). Completing this
manual sandbox check is required before describing billing as fully verified.
The existing configured monthly sandbox payment has been recognized as PRO.
Offline tests alone do not establish hosted renewal, cancellation or failure behavior.

## Server contract and recovery

Billing actions obtain the verified session owner on the server. Checkout accepts
only a billing interval (`month` or `year`); the server maps it to a configured,
validated Stripe price. User IDs, customer IDs, amounts, price IDs and redirect
URLs are never accepted from the browser. All Stripe links
are validated, and configured server origins determine the return URLs.

Signed webhooks map Stripe customers through a unique stored account relation,
then fetch current subscriptions and paid invoice lines. Invoice ownership is
matched using Stripe’s `parent.subscription_item_details.subscription` field. Event snapshots never
set tiers directly. A shared per-user PostgreSQL row lock serializes checkout,
manual refresh and webhook reconciliation. Event IDs are recorded in the same
transaction as access changes; failed transactions remain retryable. Unknown
customers and unrelated event types are acknowledged without changing access.

PRO requires an active subscription and a future paid-through date, bounded by
the matching paid invoice and subscription item period. Unpaid, paused,
incomplete, unsupported or wrong-price subscriptions cannot grant PRO. Failed
or canceled subscriptions fall back to the original unexpired trial or FREE;
ADMIN is preserved. The access guard rechecks paid expiry on every protected
request, so a missed webhook cannot extend access beyond the paid deadline.
Either configured billing interval grants the same PRO permissions. The legacy
STRIPE_PRICE_ID remains recognized for existing subscriptions. Do not remove an
active subscription price from the allowlist. Repeated requests reuse an open
Checkout for the selected price; changing intervals first expires the previous
unpaid session. Existing active/pending subscriptions go to the portal instead
of creating a second subscription. Plan switching/proration is outside this scope.

No scheduler is required for expiry. Webhooks or manual refresh are still needed
to learn cancellation, payment failure or renewal before/after that deadline.

If Stripe is unavailable, existing access remains limited by its last verified
paid deadline; the app does not grant new PRO on an error. Keep the listener up,
inspect Stripe's delivery status and retry failed deliveries after recovery.
If upgrade pricing cannot load, the UI still shows existing subscription status,
paid deadline and management/refresh controls. Provider errors never extend access.
The database stores Stripe IDs/status/deadlines, never card numbers. Refunds and
disputes do not automatically cancel a subscription; manage its status in Stripe
as an operator. This milestone does not add tax automation, coupons, plan changes,
proration or production billing.

## Automated verification

Follow the isolated test-database instructions in [ACCOUNTS.md](ACCOUNTS.md).
The existing unit/integration/browser commands and CI include the new billing
coverage. Tests use an injected fake gateway with a real isolated PostgreSQL
database, plus the real SDK's webhook-signature verification. They do not call
Stripe or submit payments. Browser tests cover account membership UI and paid
expiry using isolated fixtures. They supplement the manual sandbox checks above.
