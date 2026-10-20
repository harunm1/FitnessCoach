# Architecture

Draft for proposal section 2 (objectives, architecture and features). Built from the proposal draft in the shared Google Doc. Anything marked **open** is for the team to settle; edit this file or open an Issue.

## Objective

A user takes a quiz on goals, habits and training, gets a gym plan from an AI coach, logs workouts, and sees progress. The coach explains every exercise and, when a user taps the spot where an exercise feels wrong, asks follow-up questions and suggests fixes. No camera and no computer vision: the coach works only from what the user reports.

## System

```
browser (mobile-first)
   |
Next.js app: pages, Server Actions, route handlers
   |-- Better Auth: sessions and access tier (visitor, trial, subscriber, expired)
   |-- Prisma --> PostgreSQL
   |-- S3 client --> DigitalOcean Spaces (private: progress photos, exercise images)
   |-- AI client --> Gemini (Groq as fallback)
   |-- Stripe (test mode) --> webhook updates the user's tier
```

## Decisions

**D1. One Next.js app (course architecture A).** Pages, server logic and the API live in one TypeScript codebase. Server Actions handle forms such as the quiz and workout logging; route handlers handle the Stripe webhook and the coach's streamed replies. The alternative, a React frontend with a separate Express API, means two codebases and an API document to keep in sync, for no gain at this size.

**D2. PostgreSQL with Prisma.** Plans, workouts and subscriptions are relational: a user has a plan, a plan has exercises, a workout logs sets against them. Prisma gives typed queries and migrations in the repo. First cut of the tables: users and sessions (Better Auth), subscriptions, quiz answers, exercises, plans, plan exercises, workout logs, progress photos, chat messages.

**D3. Files in a private Spaces bucket.** Progress photos are personal, so nothing is public: the browser uploads with a short-lived signed URL and views with another. The database stores only the file key.

**D4. The AI coach returns checked data.** The coach is asked for a plan in a fixed JSON shape (exercise, sets, reps, rest, target muscle, steps). The server validates it before saving, so a malformed reply never reaches the page. Gemini and Groq sit behind one function, so switching providers is a one-line change. We use existing models and train nothing. **Open:** exercise images and the body map need an openly licensed source.

**D5. Advanced features: promise two, build more.** The course requires two. The proposal promises the two that are certain to work and lists the rest as planned:

1. **Authentication and access control** (promised): Better Auth, with the four tiers enforced on the server for every page and action, not only hidden in the UI.
2. **External APIs** (promised): the LLM coach and Stripe test-mode subscriptions.
3. **Real-time** (planned): coach replies stream in; a notification when a plan is ready, a streak milestone is hit, or a photo is due.
4. **File processing** (planned): photos resized and stripped of location data; a "then vs now" comparison image.
5. **Advanced state management** (planned): Redux Toolkit for the quiz, the body map and the live workout session.

## Scope

In: quiz, trial and subscription tiers, AI plan and coach chat, body map, workout logging, streaks and heatmap, progress photos. Out: real payments, camera or form detection, nutrition tracking, a mobile app.

## Open questions

- Gym only, or also home, yoga and pilates? The draft suggests gym only, which keeps the exercise library small.
- Deployment is optional for this course. Do we deploy for the demo, and where?
- Gemini free-tier limits during the live demo: test early, keep Groq ready.
