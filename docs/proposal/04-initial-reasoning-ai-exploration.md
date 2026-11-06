## 4. Initial Team Reasoning and AI-Assisted Exploration

### 4.1 Initial Team Reasoning

Initially, we defined the problem simply. A user takes a quiz about their goals and where they train, receives a workout plan, and an AI coach explains each exercise and keeps them on track. Two early ideas shaped the design. First, users would describe how a movement feels in chat with the coach, so we would not need a camera or video processing. Second, the coach would use a free LLM API, with Gemini as our first choice and Groq as a backup. We left three questions open: which provider to rely on, whether to support running as well as gym workouts, and which extras, such as progress photos and Stripe payments, to include.

### 4.2 Exploration and Evaluation

Our research on free-tier limits pointed to Groq, and the team tested both providers to confirm it. We wrote down how we would judge the results, then asked Groq and Gemini to create plans for the same ten user profiles. In the first round, both produced plans that passed our verifier. The real difference was reliability: on its own, each provider failed some requests because of free-tier limits or server errors.

AI helped us build this test, and we checked its answers. It assumed Groq reports how long to wait in a standard `Retry-After` header, but Groq's actual responses use a different header, so our retry logic reads that one. AI also suggested sending only six exercises per muscle group to fit Groq's token limit. We tried it and rejected it, because the coach should see every exercise the user can do; grouping names by muscle made them all fit.

### 4.3 How the Design Changed

Instead of choosing one provider, we now chain them as described in Section 2, and in our test the chain produced ten verified plans out of ten. Running is included from the start, progress photos meet the cloud storage requirement, and Stripe test mode became a stretch.
