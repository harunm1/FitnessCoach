# Design review, 10 Nov 2026, 5:30pm: benchmark against fitness platforms

Purpose: build what already works, beat it where users are hurt, and say so in the report. Sources checked 10 Nov 2026; vendor and review-site claims are marked as such and need primary-source confirmation before they go in the final paper.

## Who does what (sources)

| Product                             | What adapts the plan                                                                                                                 | Safety and control                                                                                                                                                                                                 | Source                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Fitbod                              | Generates every session from equipment, muscle recovery and history; no fixed plan library                                           | Recovery-based rotation; little periodization (reviewer view)                                                                                                                                                      | Jefit comparison 2026; review sites            |
| JuggernautAI                        | Periodized strength blocks, readiness and RPE feedback                                                                               | Powerlifting-specific                                                                                                                                                                                              | review sites                                   |
| Hevy (connector installed)          | Manual logger with social feed; Hevy Trainer (Pro) generates sessions                                                                | User owns every set; routines and folders                                                                                                                                                                          | Jefit comparison 2026; Hevy API                |
| Strong                              | Logging, plate and warm-up calculators, templates                                                                                    | None automatic                                                                                                                                                                                                     | Jefit comparison 2026                          |
| Future, Caliber                     | A human coach writes and adjusts the plan, about USD 150 to 200 a month                                                              | Human judgement                                                                                                                                                                                                    | review sites                                   |
| Runna (Strava)                      | Coach-written plans adjusted by an algorithm; "Not Feeling 100%" mode                                                                | WSJ (Feb 2026): physiotherapists reported multiple Runna-related injuries a week; Runna then added intensity dial-back and a Loughborough review                                                                   | the5krunner, 28 Sep and 25 Aug 2026; TechRadar |
| ExerciseBank (connector installed)  | Not a coach: 1,492 filmed exercises with loaded joints, impact, difficulty 1 to 5, movement pattern, ranked substitutes with reasons | Joint filter (excludeJoints)                                                                                                                                                                                       | ExerciseBank MCP, 10 Nov                       |
| claude-gym-coach plugin (installed) | Next session from the athlete's own history and real plates; RPE autoregulation; unscheduled deload when two fatigue signals agree   | Pain traffic light (green at or below 3 to 4 of 10, amber, red), method gating, rate-of-progression limits, red flags for older athletes, a stop-now list; every threshold carries a source or "unverified" marker | plugin knowledge/safety.md, agents/planner.md  |

## What FitnessCoach already does better

- Every plan passes a verifier in code before the user sees it (#47, #66). Fitbod, Runna and the chat coaches do not show users why a plan is safe; Runna added controls only after injury reports.
- Guardrails in code for pain, diagnosis, nutrition and off-topic requests (#48), not in the prompt.
- Provider fallback to a rule-based plan, so the user always gets a checked plan (#53, #59).

## What to take from them (mapped to issues)

1. Readiness before the session (Runna "Not Feeling 100%", JuggernautAI readiness): one tap "today I'm tired, sore or short on time" that lowers the session in code. New issue.
2. Pain traffic light with stated thresholds (claude-gym-coach safety.md, Silbernagel 2007 model): extends #48 and #60 from block-and-redirect to repeat, hold or stop. Thresholds cited, marked conservative.
3. Fatigue-triggered deload (planner rule: two signals agree, say so plainly, never swap silently): pairs with #65 (RPE targets).
4. Joint-aware substitutions with a stated reason (ExerciseBank): the starter plan and the coach swap an exercise for one that avoids a reported painful joint; joins #86 (level-aware starter plan). Our library has no joint data today; decide whether to map joints for the 30 exercises in #8.
5. Plate and warm-up calculator (Strong): small, high-use, no model call. Backlog.
6. Explain every change (claude-gym-coach "Squat moves up 2.5 kg: all three sets landed at RPE 8"): the "Why this plan" panel (#66) extended to week-to-week changes.
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
