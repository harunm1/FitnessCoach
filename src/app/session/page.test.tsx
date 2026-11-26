import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, redirect, prisma } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  prisma: {
    plan: { findFirst: vi.fn() },
    exercise: { findMany: vi.fn() },
    workout: { findFirst: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/photos/avatar", () => ({
  loadAvatarUrl: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/components/nav/AppNav", () => ({ AppNav: () => <nav>nav</nav> }));
vi.mock("@/components/auth/account-theme", () => ({
  AccountTheme: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/BodyMap", () => ({
  default: () => <h2>Explore by muscle</h2>,
}));
vi.mock("./actions", () => ({ startOrResumeWorkout: vi.fn() }));
import SessionPage from "./page";

const plan = {
  id: 5,
  name: "Starter plan",
  days: [
    {
      id: 9,
      dayIndex: 0,
      name: "Push day",
      weekdays: [],
      exercises: [
        {
          id: 1,
          exerciseId: "bench",
          sets: 3,
          reps: 8,
          restSeconds: 90,
          substitutionReason: null,
          exercise: {
            name: "Bench press",
            equipment: "barbell",
            primaryMuscles: ["chest"],
          },
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "owner", name: "Sam" });
  prisma.plan.findFirst.mockResolvedValue(plan);
  prisma.exercise.findMany.mockResolvedValue([]);
  prisma.workout.count.mockResolvedValue(0);
});

describe("/session (landing)", () => {
  it("reopens a workout that is open at its own address", async () => {
    prisma.workout.findFirst.mockResolvedValue({ id: 42 });
    await expect(SessionPage()).rejects.toThrow("redirect:/session/42");
  });

  it("only redirects to a workout whose page can open (a plan day still exists)", async () => {
    prisma.workout.findFirst.mockResolvedValue(null);
    renderToStaticMarkup(await SessionPage());
    const open = prisma.workout.findFirst.mock.calls
      .map(([args]) => args.where)
      .find((where) => where.finishedAt === null);
    expect(open.planDay).toEqual({ isNot: null });
  });

  it("with none open: Start, the muscle explorer and a Log a run link; no Finish", async () => {
    prisma.workout.findFirst.mockResolvedValue(null);
    const html = renderToStaticMarkup(await SessionPage());
    expect(html).toContain("Push day");
    expect(html).toContain("Bench press");
    expect(html).toContain("Start workout");
    expect(html).toContain("Explore by muscle");
    expect(html).toContain('href="/progress#run-log"');
    expect(html).toContain("Log a run");
    expect(html).toContain('href="/history/log"');
    expect(html).toContain("Log a past workout");
    expect(html).not.toContain("Finish workout");
    expect(html).not.toContain("Running distance");
  });
});
