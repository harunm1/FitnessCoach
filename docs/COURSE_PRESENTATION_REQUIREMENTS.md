# Course presentation and final report requirements

Copied in summary from the ECE1724 course site, read 22 November 2026. Pages: [Presentation Logistics](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/presentation/presentation-logistics/), [Presentation Rubric](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/presentation/presentation-rubric/), [Presentation Guidelines](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/presentation/presentation-guidelines/), [A Side Note](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/presentation/side-note/) and the [project handout](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/). The course pages are the source; if they change, they win. Our plan: [PRESENTATION.md](PRESENTATION.md).

## Dates

| What                                                                       | When                          |
| -------------------------------------------------------------------------- | ----------------------------- |
| Written introduction, 70 to 100 words, each member individually on Quercus | Wed 25 Nov 2026, 11:59 PM     |
| Slides, each member uploads the same file to Quercus                       | Thu 26 Nov 2026, 11:59 PM     |
| Presentation sessions (class starts 13:10; arrive 13:00)                   | Fri 27 Nov and Fri 4 Dec 2026 |
| Final deliverable (repository, report, AI record, video)                   | Sun 6 Dec 2026, 11:59 PM      |

Only work completed by 26 November may be shown. Substantive changes to the slides after 26 November lower the instructor and TA score; typo fixes are fine.

## Format

- 6 minutes (strictly enforced, hand signal at 1 minute left), then about 2 minutes of Q&A, then 1 minute to switch. One or two members may present; every member attends both sessions, answers Q&A if asked, and fills the peer evaluation for other teams.
- One laptop, everything open before the turn, display mirrored. USB-C and HDMI; bring an adapter.
- Written introduction contents: project name and one-sentence purpose; target users or use case; one or two core features; key web technologies.
- Explain in your own words. Slides and brief notes are prompts, not a script. AI voiceover on recordings is not permitted.

## Rubric (20 points, 5% peers and 5% instructor and TAs)

| Criterion                             | Points | What earns the top mark                                                                                                                                                        |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clarity and Communication             | 6      | Clear, well-structured, concise; purpose, architecture, key technical choices and demonstrated work explained naturally; focused Q&A answers                                   |
| Technical Progress and Demonstration  | 10     | All core requirements demonstrated and integrated, with an effective live demo, supplemented by recordings where useful                                                        |
| Advanced Features and Completion Plan | 4      | At least two advanced features: implemented ones demonstrated with purpose, design and integration; unfinished ones with a mockup or diagram and a concrete plan to 6 December |

Core technical evidence checklist: React or Next.js frontend in TypeScript with Tailwind CSS, a component library and responsive design; server-side logic (Next.js, option A) with database access; end-to-end frontend and backend interaction; PostgreSQL or SQLite used meaningfully; cloud storage connected to the workflow or data model. Reviewers score only what is shown or said.

## Live demo and backups

A live demonstration of at least one meaningful part of the working system is required. A presentation made only of recordings is not allowed. Short recordings may back up or supplement network-dependent parts (cloud storage, external APIs, authentication, deployed apps) and the presenter explains them live. Deployment is not required, but a deployed app may be the one demonstrated.

## Q&A

One main question and a short follow-up, from the instructor and TAs: architecture and technology choices, frontend and backend data flow, database or state, cloud storage, advanced feature design, trade-offs and limits, remaining work. Answer directly first, then give the evidence. Q&A counts under Clarity and Communication; unsupported answers can lower Technical Progress.

## Final deliverable (6 December)

Repository (public, or private with `cying17`, `ZihangH` and `XindanZhang` added) containing source code, `README.md` as the final report (at most 5,000 words), `ai-session.md` (2 to 4 interactions, or a statement of little or no AI use), and a 2 to 5 minute video linked from a `## Video Demo` section of the README.

Report sections the handout lists:

1. Team Information (names, student numbers, active emails)
2. Motivation
3. Objectives
4. Technical Stack and Architecture
5. Features
6. User Guide (screenshots)
7. Development Guide (environment, database initialization, cloud storage configuration, local development and testing; if credentials are needed, send them to the TA in a password-protected archive and state "Credentials sent to TA")
8. Deployment Information (live URL and platform)
9. AI Assistance and Verification (summary): where AI helped, one representative mistake or limitation, how correctness was verified
10. Individual Contributions (aligned with Git history)
11. Lessons Learned and Concluding Remarks

Marking: Technical Implementation and Integration 35%, Functionality and Engineering Quality 25%, Documentation and Reproducibility 15%, Technical Reasoning and AI Evaluation 10%, Individual Contribution 15%.
