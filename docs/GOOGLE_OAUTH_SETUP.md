# Google sign-in: setup

"Continue with Google" is switched on by two environment variables. Without them the app runs as before and the button is hidden (decision D32 in `docs/ARCHITECTURE.md`). Steps checked against Google's help pages "Get started with the Google Auth Platform" and "Manage OAuth Clients" and the Better Auth Google docs, read 25 Nov 2026. Google renames its console now and then, so a menu label may differ slightly.

Production: https://fitness-coach-psi-olive.vercel.app (the address in `docs/DEMO_SCRIPT.md`; it answered on 25 Nov 2026). Local: http://localhost:3000.

## 1. Check the app's own address first

The sign-in redirect is built from `BETTER_AUTH_URL`. In Vercel (Project > Settings > Environment Variables) the Production value must be exactly `https://fitness-coach-psi-olive.vercel.app`, with no path and no trailing slash. If it is anything else, Google will reject the sign-in with `redirect_uri_mismatch`.

## 2. Create the project and the consent screen (Google Auth Platform)

1. Open https://console.cloud.google.com/auth/overview and sign in with the Google account that should own the app.
2. Pick or create a project (for example `fitnesscoach`). Click **Get started**.
3. **App Information**: App name `FitnessCoach`, User support email = an address you read. Next.
4. **Audience**: choose **External**. Next. (Internal needs a Google Workspace organisation. Personal mode only lets the creating account sign in, so it does not fit this app.)
5. **Contact Information**: your email. Next, accept the policy if asked, then **Create**.
6. Under **Audience** (left menu) the app starts in **Testing**. In Testing only the addresses listed under **Test users** can sign in: click **Add users** and add every Google address that will log in during the demo, yours included. Anyone else sees an "access blocked" page.
   - To let any Google account in, click **Publish app** on the same page. Google says production apps go through its OAuth app verification (see the Verification Center in the console), so check what it asks of an app that only requests `openid`, `email` and `profile` before relying on it. For a one-day demo, Testing with a test-user list is the safer choice.

## 3. Create the OAuth client

1. Open https://console.developers.google.com/auth/clients and click **Create client**.
2. Application type: **Web application**. Name: `FitnessCoach web`.
3. **Authorized JavaScript origins** (origin only, no path, no trailing slash):
   - `https://fitness-coach-psi-olive.vercel.app`
   - `http://localhost:3000`
4. **Authorized redirect URIs** (the path is Better Auth's fixed callback, `/api/auth/callback/google`; the integration test asserts it):
   - `https://fitness-coach-psi-olive.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
5. **Create**. A dialog shows the **Client ID** and the **Client secret**. Copy both now: Google shows the full secret only once. If it is lost, open the client, **Add secret**, and use the new one.
6. Google says changes to these settings can take from 5 minutes to a few hours to apply.

## 4. Set the two variables

Production (Vercel):

1. Project > Settings > Environment Variables.
2. Add `GOOGLE_CLIENT_ID` with the Client ID, environment **Production**.
3. Add `GOOGLE_CLIENT_SECRET` with the Client secret, environment **Production**, marked Sensitive.
4. Redeploy Production (Deployments > latest Production deployment > Redeploy). A variable only reaches deployments built after it was added.

Local, in `.env.local` at the project root (never commit it):

```
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
```

Restart `npm run dev` afterwards.

## 5. Check it

Open `/sign-in`. The white "Continue with Google" button sits above the email form. With a listed test user: Google account chooser, consent, then back on `/account` signed in with the FREE tier. If the button is missing, one of the two variables is empty or not in this environment.

## Rules worth knowing

- **Preview deployments cannot use Google.** Google matches redirect URIs exactly, and every Vercel preview has its own address, so `https://<preview>.vercel.app/api/auth/callback/google` would have to be registered one by one. Use production or localhost to test Google sign-in. Set the two variables on Production only, as above: previews then hide the button instead of ending on Google's `redirect_uri_mismatch` page.
- **Linking.** A Google sign-in with the same email as an existing account joins that account only if that account's email is already verified (and Google reports it verified). Otherwise the sign-in page says to verify the email first. A brand-new Google user is created with the FREE tier and no trial.
- **Errors you may see from Google:** `redirect_uri_mismatch` (a redirect URI above is missing or differs by one character, or `BETTER_AUTH_URL` is wrong), `origin_mismatch` (a JavaScript origin is missing), `access_denied` or "access blocked" (the address is not a test user while the app is in Testing).
