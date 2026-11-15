import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createAuth } from "@/lib/auth/core";
import type { CoachChatMessage } from "@/lib/coach/providers";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const exerciseCoach = vi.hoisted(() => ({
  model: vi.fn<(messages: CoachChatMessage[]) => Promise<string>>(),
  factory: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});
vi.mock("@/lib/auth", () => ({ getAuth: async () => auth }));
vi.mock("@/lib/coach/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/coach/providers")>()),
  coachChatModel: exerciseCoach.factory,
}));

import { prisma as db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { saveQuizProfile } from "@/app/onboarding/actions";
import OnboardingPage from "@/app/onboarding/page";
import SessionPage from "@/app/session/page";
import { askExerciseCoach } from "@/app/session/bodyMapActions";
import {
  finishWorkout,
  logSet,
  saveRunMetrics,
  startOrResumeWorkout,
} from "@/app/session/actions";

const prefix = `quiz-session-${randomUUID()}`;
const password = "Quiz-session-test-password-123!";
const baseURL = "http://localhost:3000";
const exercises = [`${prefix}-press`, `${prefix}-squat`];
const idle = { status: "idle" as const, message: "" };
let auth: ReturnType<typeof createAuth>;
let first: { id: string; email: string };
let second: { id: string; email: string };
let passwordHash: string;

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function athlete(label: string) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name: label,
      email: `${prefix}-${label}-${id}@example.test`,
      emailVerified: true,
      accounts: {
        create: {
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
  });
}

async function signIn(user: { email: string }) {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseURL,
        "x-forwarded-for": `2001:db8:${randomUUID().slice(0, 4)}::1`,
      },
      body: JSON.stringify({ email: user.email, password }),
    }),
  );
  expect(response.status).toBe(200);
  request.headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; "),
  });
}

async function plan(
  userId: string,
  name: string,
  exerciseId = exercises[0],
  includeSecondExercise = false,
) {
  return db.plan.create({
    data: {
      userId,
      name,
      source: "DEFAULT",
      days: {
        create: {
          name: `${name} day`,
          dayIndex: 0,
          exercises: {
            create: [
              {
                exerciseId,
                order: 0,
                sets: 3,
                reps: 10,
                restSeconds: 90,
              },
              ...(includeSecondExercise
                ? [
                    {
                      exerciseId:
                        exercises.find((id) => id !== exerciseId) ??
                        exercises[1],
                      order: 1,
                      sets: 3,
                      reps: 10,
                      restSeconds: 90,
                    },
                  ]
                : []),
            ],
          },
        },
      },
    },
    include: { days: true },
  });
}

async function workout(
  userId: string,
  savedPlan: Awaited<ReturnType<typeof plan>>,
) {
  return db.workout.create({
    data: { userId, planId: savedPlan.id, planDayId: savedPlan.days[0].id },
  });
}

beforeAll(async () => {
  passwordHash = await hashPassword(password);
  await db.exercise.createMany({
    data: exercises.map((id, i) => ({
      id,
      name: `${prefix} ${i ? "Squat" : "Press"}`,
      level: "BEGINNER",
      category: "strength",
      equipment: "body only",
      primaryMuscles: [i ? "quadriceps" : "chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    })),
  });
});

beforeEach(async () => {
  request.headers = new Headers();
  exerciseCoach.model.mockReset();
  exerciseCoach.model.mockResolvedValue("Keep the movement controlled.");
  exerciseCoach.factory.mockReset();
  exerciseCoach.factory.mockReturnValue(exerciseCoach.model);
  auth = createAuth(
    db,
    {
      baseURL,
      secret: "quiz-session-integration-secret-at-least-32-characters",
    },
    async () => {},
  );
  first = await athlete("first");
  second = await athlete("second");
});

afterEach(async () => {
  request.headers = new Headers();
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
});

afterAll(async () => {
  await db.exercise.deleteMany({ where: { id: { in: exercises } } });
  await db.$disconnect();
});

describe("quiz and session authorization with PostgreSQL", () => {
  it.each([
    ["quiz action", () => saveQuizProfile(idle, new FormData())],
    ["set action", () => logSet(exercises[0], idle, new FormData())],
    ["run action", () => saveRunMetrics(idle, new FormData())],
    ["start action", () => startOrResumeWorkout()],
    ["finish action", () => finishWorkout()],
    [
      "exercise coach action",
      () =>
        askExerciseCoach(
          "chest",
          exercises[0],
          idle,
          form({ question: "How do I keep the movement controlled?" }),
        ),
    ],
    [
      "exercise coach action with invalid input",
      () => askExerciseCoach("unsupported", exercises[0], idle, new FormData()),
    ],
    ["quiz page", () => OnboardingPage()],
    ["session page", () => SessionPage()],
  ] as const)(
    "redirects a signed-out caller of the %s before processing data",
    async (_label, call) => {
      await expect(call()).rejects.toThrow("redirect:/sign-in");
      expect(
        await db.workout.count({
          where: { userId: { in: [first.id, second.id] } },
        }),
      ).toBe(0);
      expect(exerciseCoach.factory).not.toHaveBeenCalled();
      expect(exerciseCoach.model).not.toHaveBeenCalled();
      expect(
        await db.conversation.count({
          where: { userId: { in: [first.id, second.id] } },
        }),
      ).toBe(0);
    },
  );

  it.each(["revoked", "expired", "unverified"])(
    "rejects a %s session at the action boundary",
    async (state) => {
      await signIn(first);
      if (state === "revoked")
        await db.session.deleteMany({ where: { userId: first.id } });
      if (state === "expired")
        await db.session.updateMany({
          where: { userId: first.id },
          data: { expiresAt: new Date(0) },
        });
      if (state === "unverified")
        await db.user.update({
          where: { id: first.id },
          data: { emailVerified: false },
        });
      await expect(saveQuizProfile(idle, new FormData())).rejects.toThrow(
        "redirect:/sign-in",
      );
      await expect(
        askExerciseCoach(
          "chest",
          exercises[0],
          idle,
          form({ question: "How do I keep the movement controlled?" }),
        ),
      ).rejects.toThrow("redirect:/sign-in");
      expect(exerciseCoach.factory).not.toHaveBeenCalled();
      expect(exerciseCoach.model).not.toHaveBeenCalled();
    },
  );

  it.each(["FREE", "TRIAL", "PRO", "ADMIN"] as const)(
    "keeps the quiz and session available to a verified %s user",
    async (tier) => {
      // Even an expired trial can still use the rule-based plan and logging.
      await db.user.update({
        where: { id: first.id },
        data: { tier, trialEndsAt: tier === "TRIAL" ? new Date(0) : null },
      });
      await signIn(first);
      await expect(OnboardingPage()).resolves.toBeDefined();
      await expect(SessionPage()).resolves.toBeDefined();
    },
  );

  it("returns current tier and trial fields from the verified session", async () => {
    await signIn(first);
    expect(await requireUser()).toMatchObject({
      id: first.id,
      tier: "FREE",
      trialEndsAt: null,
    });
    const trialEndsAt = new Date(Date.now() + 86400000);
    await db.user.update({
      where: { id: first.id },
      data: { tier: "TRIAL", trialEndsAt },
    });
    expect(await requireUser()).toMatchObject({
      id: first.id,
      tier: "TRIAL",
      trialEndsAt,
    });
  });

  it.each([
    ["FREE", false, false],
    ["TRIAL", false, false],
    ["TRIAL", true, true],
    ["PRO", false, false],
    ["PRO", true, true],
    ["ADMIN", false, true],
  ] as const)(
    "checks exercise-chat access for %s with active entitlement %s",
    async (tier, active, allowed) => {
      await db.user.update({
        where: { id: first.id },
        data: {
          tier,
          trialEndsAt:
            tier === "TRIAL"
              ? new Date(active ? Date.now() + 86400000 : 0)
              : null,
        },
      });
      if (tier === "PRO" && active) {
        await db.billingAccount.create({
          data: {
            userId: first.id,
            stripeCustomerId: `cus_coach_${randomUUID()}`,
            status: "active",
            paidUntil: new Date(Date.now() + 86400000),
          },
        });
      }
      await signIn(first);
      const result = await askExerciseCoach(
        "chest",
        exercises[0],
        idle,
        form({ question: "How do I keep the movement controlled?" }),
      );
      expect(result.status).toBe(allowed ? "success" : "error");
      expect(exerciseCoach.factory).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(exerciseCoach.model).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(await db.conversation.count({ where: { userId: first.id } })).toBe(
        allowed ? 1 : 0,
      );
      expect(
        await db.user.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({ lastCoachPlanRequestedAt: null });
    },
  );

  it("rechecks exercise-chat access without a new login after trial or billing expiry", async () => {
    await db.user.update({
      where: { id: first.id },
      data: { tier: "TRIAL", trialEndsAt: new Date(Date.now() + 86400000) },
    });
    await signIn(first);
    const ask = () =>
      askExerciseCoach(
        "chest",
        exercises[0],
        idle,
        form({ question: "How do I keep the movement controlled?" }),
      );
    expect((await ask()).status).toBe("success");
    await db.user.update({
      where: { id: first.id },
      data: { trialEndsAt: new Date(0) },
    });
    expect((await ask()).status).toBe("error");
    expect(exerciseCoach.model).toHaveBeenCalledTimes(1);
    await db.user.update({ where: { id: first.id }, data: { tier: "PRO" } });
    await db.billingAccount.create({
      data: {
        userId: first.id,
        stripeCustomerId: `cus_coach_${randomUUID()}`,
        status: "active",
        paidUntil: new Date(Date.now() + 86400000),
      },
    });
    expect((await ask()).status).toBe("success");
    await db.billingAccount.update({
      where: { userId: first.id },
      data: { paidUntil: new Date(0) },
    });
    expect((await ask()).status).toBe("error");
    expect(exerciseCoach.model).toHaveBeenCalledTimes(2);
  });

  it("keeps exercise-chat history and model context separate for each signed-in user", async () => {
    await db.user.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { tier: "TRIAL", trialEndsAt: new Date(Date.now() + 86400000) },
    });
    const firstQuestion = "How should I position my wrists for this press?";
    const secondQuestion = "How slowly should I lower this press?";
    const firstReply = "Keep your wrists stacked over your elbows.";
    const secondReply = "Lower the weight with control.";
    exerciseCoach.model
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(secondReply);

    await signIn(first);
    const firstResult = await askExerciseCoach(
      "chest",
      exercises[0],
      idle,
      form({ question: firstQuestion, userId: second.id }),
    );
    expect(firstResult).toMatchObject({
      status: "success",
      turns: [
        { role: "USER", content: firstQuestion },
        { role: "ASSISTANT", content: firstReply },
      ],
    });
    const firstConversation = await db.conversation.findFirstOrThrow({
      where: { userId: first.id },
      include: { messages: true },
    });

    await signIn(second);
    const secondResult = await askExerciseCoach(
      "chest",
      exercises[0],
      { ...idle, turns: firstResult.turns },
      form({
        question: secondQuestion,
        userId: first.id,
        conversationId: String(firstConversation.id),
      }),
    );
    expect(secondResult).toMatchObject({
      status: "success",
      turns: [
        { role: "USER", content: secondQuestion },
        { role: "ASSISTANT", content: secondReply },
      ],
    });
    expect(exerciseCoach.model.mock.calls[1][0]).toHaveLength(2);
    expect(JSON.stringify(exerciseCoach.model.mock.calls[1][0])).not.toContain(
      firstQuestion,
    );
    expect(
      await db.conversation.findUniqueOrThrow({
        where: { id: firstConversation.id },
        include: { messages: true },
      }),
    ).toEqual(firstConversation);
    const secondConversation = await db.conversation.findFirstOrThrow({
      where: { userId: second.id },
      include: { messages: true },
    });
    expect(secondConversation.id).not.toBe(firstConversation.id);
    expect(secondConversation.messages).toHaveLength(2);

    await signIn(first);
    const followUp = await askExerciseCoach(
      "chest",
      exercises[0],
      idle,
      form({ question: "Where should my elbows point?" }),
    );
    expect(followUp.status).toBe("success");
    expect(followUp.turns).toHaveLength(4);
    expect(followUp.turns?.slice(0, 2)).toEqual(firstResult.turns);
    expect(JSON.stringify(exerciseCoach.model.mock.calls[2][0])).not.toContain(
      secondQuestion,
    );
    expect(exerciseCoach.model.mock.calls[2][0]).toContainEqual({
      role: "user",
      content: firstQuestion,
    });
    expect(
      await db.conversation.count({
        where: { userId: { in: [first.id, second.id] } },
      }),
    ).toBe(2);
    expect(
      await db.message.count({
        where: { conversation: { userId: first.id } },
      }),
    ).toBe(4);
    expect(
      await db.message.count({
        where: { conversation: { userId: second.id } },
      }),
    ).toBe(2);
  });

  it("saves the signed-in user's quiz and plan without replacing another user's data", async () => {
    const ownPlan = await plan(first.id, "First old plan");
    const otherPlan = await plan(second.id, "Second private plan");
    const otherProfile = await db.profile.create({
      data: {
        userId: second.id,
        goal: "STRENGTH",
        level: "EXPERT",
        daysPerWeek: 4,
        equipment: ["barbell"],
      },
    });
    await signIn(first);
    const answers = form({
      goal: "MUSCLE",
      level: "BEGINNER",
      daysPerWeek: "3",
      equipment: "body only",
      injuries: "",
      userId: second.id,
      email: second.email,
      planId: String(otherPlan.id),
    });
    expect((await saveQuizProfile(idle, answers)).status).toBe("success");
    expect(
      await db.profile.findUnique({ where: { userId: second.id } }),
    ).toEqual(otherProfile);
    expect(
      (await db.plan.findUniqueOrThrow({ where: { id: otherPlan.id } })).active,
    ).toBe(true);
    expect(
      (await db.plan.findUniqueOrThrow({ where: { id: ownPlan.id } })).active,
    ).toBe(false);
    expect(
      await db.plan.count({ where: { userId: first.id, active: true } }),
    ).toBe(1);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: first.id } }))
        .goal,
    ).toBe("MUSCLE");
  });

  it("shows only the signed-in user's plan on the session page", async () => {
    await plan(first.id, "First visible plan");
    await plan(second.id, "Second private plan");
    await signIn(first);
    const html = renderToStaticMarkup(await SessionPage());
    expect(html).toContain("First visible plan");
    expect(html).not.toContain("Second private plan");
  });

  it("shows saved cues and mistakes only for exercises that have them", async () => {
    await db.exercise.update({
      where: { id: exercises[0] },
      data: {
        cues: ["Brace before the press."],
        commonMistakes: ["Letting the wrists bend back."],
      },
    });
    await plan(first.id, "Plan with mixed cue coverage", exercises[0], true);
    await signIn(first);

    const html = renderToStaticMarkup(await SessionPage());

    expect(html).toContain("Form guidance");
    expect(html).toContain("Form cues");
    expect(html).toContain("Brace before the press.");
    expect(html).toContain("Common mistakes");
    expect(html).toContain("Letting the wrists bend back.");
    expect(html).toContain(`${prefix} Squat`);
    expect(html.match(/Form guidance/g)).toHaveLength(1);
  });

  it("does not borrow another user's plan when the caller has none", async () => {
    await plan(second.id, "Second private plan");
    await signIn(first);
    const html = renderToStaticMarkup(await SessionPage());
    expect(html).not.toContain("Second private plan");
    await expect(startOrResumeWorkout()).rejects.toThrow(
      "redirect:/onboarding",
    );
    expect(await db.workout.count({ where: { userId: first.id } })).toBe(0);
  });

  it("starts and resumes only the owner's workout", async () => {
    const ownPlan = await plan(first.id, "First plan");
    const otherPlan = await plan(second.id, "Second plan");
    const otherWorkout = await workout(second.id, otherPlan);
    await signIn(first);
    await expect(startOrResumeWorkout()).rejects.toThrow("redirect:/session");
    await expect(startOrResumeWorkout()).rejects.toThrow("redirect:/session");
    const saved = await db.workout.findMany({ where: { userId: first.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      planId: ownPlan.id,
      planDayId: ownPlan.days[0].id,
    });
    expect(
      await db.workout.findUnique({ where: { id: otherWorkout.id } }),
    ).toEqual(otherWorkout);
  });

  it("ignores forged owner and workout fields when logging a set", async () => {
    const ownWorkout = await workout(
      first.id,
      await plan(first.id, "First plan"),
    );
    const otherWorkout = await workout(
      second.id,
      await plan(second.id, "Second plan"),
    );
    await signIn(first);
    await expect(
      logSet(
        exercises[0],
        idle,
        form({
          setNumber: "1",
          reps: "8",
          weightKg: "12",
          userId: second.id,
          workoutId: String(otherWorkout.id),
        }),
      ),
    ).rejects.toThrow("redirect:/session");
    expect(
      await db.setLog.count({ where: { workoutId: otherWorkout.id } }),
    ).toBe(0);
    expect(
      await db.setLog.findFirst({ where: { workoutId: ownWorkout.id } }),
    ).toMatchObject({ reps: 8, setNumber: 1 });
  });

  it("cannot log an exercise that is only on another user's plan", async () => {
    await workout(first.id, await plan(first.id, "First plan"));
    const otherWorkout = await workout(
      second.id,
      await plan(second.id, "Second plan", exercises[1]),
    );
    await signIn(first);
    expect(
      (
        await logSet(
          exercises[1],
          idle,
          form({ setNumber: "1", reps: "8", weightKg: "12" }),
        )
      ).status,
    ).toBe("error");
    expect(
      await db.setLog.count({ where: { workoutId: otherWorkout.id } }),
    ).toBe(0);
  });

  it("cannot use another user's active workout to log sets or a run", async () => {
    const otherWorkout = await workout(
      second.id,
      await plan(second.id, "Second plan"),
    );
    await signIn(first);
    expect(
      (
        await logSet(
          exercises[0],
          idle,
          form({ setNumber: "1", reps: "8", weightKg: "12" }),
        )
      ).status,
    ).toBe("error");
    expect(
      (
        await saveRunMetrics(
          idle,
          form({
            distanceKm: "5",
            durationMinutes: "30",
            durationSeconds: "15",
          }),
        )
      ).status,
    ).toBe("error");
    expect(
      await db.workout.findUnique({ where: { id: otherWorkout.id } }),
    ).toEqual(otherWorkout);
    expect(
      await db.setLog.count({ where: { workoutId: otherWorkout.id } }),
    ).toBe(0);
    await expect(finishWorkout()).rejects.toThrow("redirect:/session");
    expect(
      (await db.workout.findUniqueOrThrow({ where: { id: otherWorkout.id } }))
        .finishedAt,
    ).toBeNull();
  });

  it("saves run metrics and finishes only the owner's workout", async () => {
    const ownWorkout = await workout(
      first.id,
      await plan(first.id, "First plan"),
    );
    const otherWorkout = await workout(
      second.id,
      await plan(second.id, "Second plan"),
    );
    await signIn(first);
    await expect(
      saveRunMetrics(
        idle,
        form({
          distanceKm: "5.25",
          durationMinutes: "30",
          durationSeconds: "15",
          workoutId: String(otherWorkout.id),
          userId: second.id,
        }),
      ),
    ).rejects.toThrow("redirect:/session");
    const saved = await db.workout.findUniqueOrThrow({
      where: { id: ownWorkout.id },
    });
    expect(saved.distanceKm?.toString()).toBe("5.25");
    expect(saved.durationSeconds).toBe(1815);
    await expect(finishWorkout()).rejects.toThrow("redirect:/session");
    expect(
      (await db.workout.findUniqueOrThrow({ where: { id: ownWorkout.id } }))
        .finishedAt,
    ).not.toBeNull();
    expect(
      await db.workout.findUnique({ where: { id: otherWorkout.id } }),
    ).toEqual(otherWorkout);
  });
});
