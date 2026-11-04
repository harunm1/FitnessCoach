# Presentation plan

From the course's presentation guidelines and rubric (read 3 November). Slides are due Thu 26 Nov, 11:59pm, on Quercus and are the ones we present from; the talk shows our progress as of 26 November.

## What the course asks for

- **6 minutes, then about 2 minutes of Q&A** with the instructor and TAs. 10% of the course grade: 5% peers, 5% instructor and TAs, same 20-point rubric (clarity and communication 6, technical progress and demonstration 10, advanced features and completion plan 4).
- **A live demo is required.** It shows evidence, not page loads: a real request, mutation or state change, explained as it happens. Short, a few actions, ready to be cut.
- **Core evidence covers five areas:** React or Next.js frontend in TypeScript; backend logic in server functions; frontend and backend integration; PostgreSQL persistence; cloud storage tied to the workflow.
- **At least two advanced features:** implemented ones get a brief demo and how they integrate; unfinished ones get the design, supporting material and a concrete plan to finish by the final deadline.
- **Backups** (recording or screenshots) for anything that depends on Wi-Fi, cloud storage, external APIs or authentication. They supplement the live demo, not replace it.
- **Every team member answers Q&A** on architecture, data flow, storage, advanced features, trade-offs and remaining work: direct answer, then the evidence, then the limitation.

## Our six minutes (draft)

| Time        | Section                                                        | Evidence on screen                                                     |
| ----------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0:00 – 0:40 | The problem and who it is for                                  | One slide (Section 1 of the proposal)                                  |
| 0:40 – 1:30 | Architecture                                                   | The component diagram: Next.js, Server Actions, PostgreSQL, bucket, AI |
| 1:30 – 4:00 | Live demo                                                      | See below                                                              |
| 4:00 – 5:15 | Advanced features: sign-in with tiers; the coach behind checks | Tier check on the server; the coach plan and its fallback              |
| 5:15 – 6:00 | Evidence and what's left                                       | Eval and CI replay numbers, tests, call log; completion plan           |

## Live demo (about 2.5 minutes)

1. **Sign in** as the trial demo user: a real session from Better Auth (advanced feature 1).
2. **Quiz to plan, instantly:** a Server Action writes the profile and a rule-based week to PostgreSQL; the plan page reads it back (D11).
3. **Log a set:** a mutation and the state change on the session screen.
4. **Progress photo:** upload to the private bucket and view it through a short-lived URL (cloud storage).
5. **Personalize with the coach:** the model's plan passes the verifier and replaces the week (advanced feature 2); with the provider unreachable, the fallback shows at once (D12).

**Backups:** a recording of steps 4 and 5 and screenshots of the call log, in case Wi-Fi, the bucket or the providers fail.

## Evidence we already have

- Coach eval, 10 fixed profiles: the Groq-then-Gemini chain served 10 of 10 verified plans (`docs/COACH_EVAL.md`), replayed in CI on every pull request.
- Unit tests on the verifier, providers, guardrails, running and hybrid weeks; CI runs format, lint, types and tests.
- Decisions D1 to D14 in `docs/ARCHITECTURE.md`; design review in `docs/design-reviews/`.

## Still to decide as a team

- Who speaks each section and who drives the demo.
- One full rehearsal with a timer, in the 24 to 26 Nov window.
