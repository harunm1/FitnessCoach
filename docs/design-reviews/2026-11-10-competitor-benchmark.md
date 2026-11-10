# Design review, 10 Nov 2026, 5:30pm: benchmark against fitness platforms

Purpose: build what already works, beat it where users are hurt, and say so in the report. Sources checked 10 Nov 2026; vendor and review-site claims are marked as such and need primary-source confirmation before they go in the final paper.

## Who does what (sources)

| Product                             | What adapts the plan                                                                                                                                                                      | Safety and control                                                                                                                                                                                                                                                                                                                                                       | Source                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Fitbod                              | Generates every session from goal, equipment, logged history and muscle recovery; no fixed plan library                                                                                   | Recovery-based rotation; little periodization (reviewer view, unverified: Fitbod's help page describes varied intensity and volume and periodic Max Effort Days)                                                                                                                                                                                                         | Fitbod help pages (vendor); Jefit's own comparison 2026 (vendor, not independent)            |
| JuggernautAI                        | Periodized strength blocks, readiness and RPE feedback                                                                                                                                    | Powerlifting-first; also offers powerbuilding (vendor)                                                                                                                                                                                                                                                                                                                   | vendor site; review sites                                                                    |
| Hevy (connector installed)          | Manual logger with social feed; Hevy Trainer (Pro, about USD 2.99 a month, no AI) generates sessions                                                                                      | User owns every set; routines and folders. Trainer has an injury setting that swaps or warns, opt-in deload weeks and suggested swaps; no stated joint or reason model                                                                                                                                                                                                   | hevyapp.com Trainer page (modified 9 Nov 2026, vendor); Hevy API                             |
| Strong                              | Logging, plate and warm-up calculators (Hevy has both too), templates                                                                                                                     | None automatic                                                                                                                                                                                                                                                                                                                                                           | strong.app and its App Store listing (vendor)                                                |
| Future, Caliber                     | A human coach writes and adjusts the plan, about USD 200 a month for one-to-one coaching (Future USD 199; Caliber USD 200 or more; Caliber also has cheaper self-directed tiers)          | Human judgement                                                                                                                                                                                                                                                                                                                                                          | future.co (vendor); review sites                                                             |
| Runna (Strava)                      | Coach-written plans adjusted by an algorithm; "Not Feeling 100%" mode                                                                                                                     | A WSJ reporter quotes physical therapists who saw multiple injured Runna users a week (paywalled; read in full before citing; the Feb 2026 date is not verified). Runna then announced ways to tone plans down and, in Aug 2026, commissioned a Loughborough review of its pace, distance and recovery logic (findings not yet published)                                | the5krunner, 28 Sep and 25 Aug 2026; Loughborough news, Aug 2026; TechRadar (not re-checked) |
| ExerciseBank (connector installed)  | Not a coach: 1,492 catalogued exercises (video on a 50-exercise sample on the free tier) with loaded joints, impact, difficulty 1 to 5, movement pattern, ranked substitutes with reasons | Joint filter (excludeJoints)                                                                                                                                                                                                                                                                                                                                             | ExerciseBank MCP, 10 Nov                                                                     |
| claude-gym-coach plugin (installed) | Next session from the athlete's own history and real plates; RPE autoregulation; unscheduled deload when two fatigue signals agree                                                        | Pain traffic light (green at or below 3 to 4 of 10, amber, red), method gating, rate-of-progression limits, red flags for older athletes, a stop-now list; every threshold carries a source or "unverified" marker. The traffic light cites Silbernagel 2007, an RCT of 38 Achilles tendinopathy patients, so using it for general strength training is an extrapolation | plugin knowledge/safety.md, agents/planner.md, README.md                                     |

## What FitnessCoach already does better

- The rule-based starter plan is checked by `verifyPlan` before it is saved (on main). The model-generated path (`generatePlan`, issue #11) also verifies in code but is not wired to a page yet, and the "Why this plan" panel (#66, PR #88) is open and not mounted. The apps in the table do not show the user why a plan was accepted, as far as the sources above say (not exhaustively checked); Runna announced plan-toning options after the injury reports.
- Guardrails in code for pain, diagnosis and off-topic requests are in open PR #48 (not merged), not in the prompt. Nutrition is out of scope since the 8 Nov decision.
- `generatePlan` falls back to the rule-based plan (on main, not yet mounted); the chat-turn fallback is open PR #53 and the demo-resilience cache is open issue #59.

## What to take from them (mapped to issues)

1. Readiness before the session (Runna "Not Feeling 100%", JuggernautAI readiness): one tap "today I'm tired, sore or short on time" that lowers the session in code. New issue.
2. Pain traffic light with stated thresholds (claude-gym-coach safety.md, Silbernagel 2007 model): extends #48 and #60 from block-and-redirect to repeat, hold or stop. Thresholds cited, marked conservative; Silbernagel is an Achilles tendinopathy trial, so the general threshold is an extrapolation.
3. Fatigue-triggered deload (planner rule: two signals agree, say so plainly, never swap silently): pairs with #65 (RPE targets).
4. Joint-aware substitutions with a stated reason (ExerciseBank; Hevy Trainer has an injury setting that swaps or warns, without a stated joint or reason model): the starter plan and the coach swap an exercise for one that avoids a reported painful joint; joins #86 (starter plan prefers exercises at or below the user's level). Our library has no joint data today; decide whether to map joints for the 30 exercises in #8.
5. Plate and warm-up calculator (Strong, Hevy): small, high-use, no model call. Backlog.
6. Explain every change (claude-gym-coach README: "Squat moves up 2.5 kg: all three sets landed at RPE 8"): the "Why this plan" panel (#66) extended to week-to-week changes.
7. Import from Hevy or Strong (CSV) so a user's history seeds the plan: stretch, after the checkpoint.

## Not taking

- Generating every session from scratch (Fitbod): conflicts with the verified weekly plan and is what reviewers say limits periodization.
- Human-coach tier (Future): out of scope for a course project.
- Nutrition or macros: out of scope since the 8 Nov decision.

## Open decision: domain names (FitnessCoach and CAIRO)

Checked on 10 Nov 2026 (about 5:30pm Toronto) with an RDAP lookup (`https://rdap.org/domain/<name>`; 404 means no registration record). The note lists five candidates: three for FitnessCoach, two for CAIRO.

| Project      | Domain            | RDAP result                                           |
| ------------ | ----------------- | ----------------------------------------------------- |
| FitnessCoach | verifiedcoach.app | 404, no registration record                           |
| FitnessCoach | repcheck.app      | registered 25 May 2026 (GoDaddy), expires 25 May 2027 |
| FitnessCoach | safeset.app       | registered 27 Jul 2020 (GoDaddy), expires 27 Jul 2030 |
| CAIRO        | cairo-code.app    | 404, no registration record                           |
| CAIRO        | askcairo.dev      | 404, no registration record                           |

A 404 only says the name is unregistered; a registrar can still treat it as reserved or premium, so check the price at purchase. Team decision for FitnessCoach; Dr. Emara's for CAIRO.

## Priority against the Sun 15 Nov core path

Items 1 to 7 are after the checkpoint except as wording in the report. The core path (quiz, plan, session, sign-in, verified coach plan) comes first.
