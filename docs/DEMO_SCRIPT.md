<!-- Purpose: the numbered click path for the live demo, with what the audience must see and the fallback for each step. -->

# Demo script

The click path for the live demonstration (about 100 seconds of the 6-minute talk) on https://fitness-coach-psi-olive.vercel.app. Mohammad drives. It follows the five steps in `docs/PRESENTATION.md` (Live demo) and adds the quiz as an optional step. Only features merged to main by Thu 26 Nov appear. The Hevy import (PR #147) is not on main at the time of writing and stays out unless it merges by then.

Status: written 23 Nov from the code on main (3d6bad7) and the presentation plan. The timings column is filled from the rehearsal walk on the live site; labels marked (check) are confirmed on that walk.

## Before the demo (once, the day before and again 10 minutes before)

- One demo account, verified, onboarded, with an active plan, two weeks of logged workouts and one progress photo. Sign in once on the demo laptop so the session is warm, then sign out so step 1 shows a real sign-in.
- The coach needs a trial, pro or admin tier. The free trial lasts 7 days from the moment it is started on `/account`, so start it on Thu 3 Dec for the Fri 4 Dec presentation (a trial started on 23 Nov has ended by then).
- Vercel settings for the coach (issue #57): `GROQ_API_KEY`, `GEMINI_API_KEY`, `COACH_DEMO_MODE=1`, `GEMINI_MODEL=gemini-3.5-flash-lite`. One real chat exchange on the live site the day before.
- Browser at 1280 x 720, zoom 100%, tabs open in step order, notifications off, display mirrored, Wi-Fi checked. The backup recording of steps 4 and 5 is open in a separate window.

## Click path

| #   | Mohammad clicks                                                                                                                  | The audience must see                                                                                             | If it fails                                                                                                                      | Time |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `/sign-in`: types the demo email and password, presses **Sign in** (Shubham's line while the page loads: tier checked on server) | Lands on the session screen with the demo user's name in the header: a real session, not a static page            | Wrong password or no mail service: sign in on the second laptop (already signed in) and carry on from there                      | 15 s |
| 2   | Optional, only with spare time: **Quiz** (`/onboarding`), change one answer, **Save profile**                                    | The plan appears at once (D11: rule-based, no wait) and is read back from PostgreSQL                              | Skip it. Open the saved plan instead; say the quiz writes the same plan                                                          | 25 s |
| 3   | **Session** tab: opens today's workout, then **Why this plan**                                                                   | Today's exercises with sets and reps, and the panel naming the profile fields that picked them                    | Reload once. If the page is empty, the account lost its plan: use the second laptop                                              | 15 s |
| 4   | In the first exercise, types the reps and weight, presses **Log set 1**, once, no double tap                                     | The button shows "Saving...", then the counter reads "1 / 3 sets logged" and the row persists after a reload      | If "Could not save this set" shows, wait a second and press once more; say the save is keyed on workout, exercise and set number | 15 s |
| 5   | **Coach** tab: types or taps one quick reply (for example "can I swap squats for lunges today?"), **Send**                       | The reply streams a sentence at a time, passes the checks, and is still there after a reload (it was saved)       | Demo mode shows the cached plan at once. If the page says the coach is unavailable, say that is the designed fallback (D12)      | 30 s |
| 6   | **Photos** tab: the file field (the browser's own chooser), picks the prepared photo, **Upload photo**, then opens it            | The photo appears in the strip; its address is a short-lived signed link to the private bucket, not a public file | Play the backup recording of steps 5 and 6 while explaining the signed URL and the private R2 bucket                             | 25 s |

Total with the optional quiz: 125 s; without it: 100 s. The demo is cut at 4:40 on the clock whatever step it is on.

## Rules on stage

- One action per click and say what happened after it; never click twice on **Log set**.
- If a step has not answered after 3 seconds, say what it is doing ("the request is on its way to the server") and move on at 6 seconds to the fallback.
- Never open `/account`, billing or an admin view on stage.
- Steps 5 and 6 depend on the network, the model providers and the bucket, so the backup recording stays open; it supplements the live demo and never replaces it (course rule, Lecture 10).

## Sources

`docs/PRESENTATION.md` (Live demo, Backups, Logistics); `docs/ARCHITECTURE.md` (D11, D12); `docs/ACCOUNTS.md` (tiers and trial); `src/components/SetLogForm.tsx`, `src/app/coach/CoachForm.tsx`, `src/components/photos/PhotoUploadForm.tsx` (button labels).
