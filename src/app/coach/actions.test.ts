// The coach Server Action (#63): one exchange saved for the session owner, guardrails before any model call.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_REPLY } from "@/lib/coach/chat";
import { REPLIES } from "@/lib/coach/guardrails";
import {
  LOAD_FAILED_MESSAGE,
  NO_PROFILE_MESSAGE,
  RATE_DAY_MESSAGE,
  RATE_MINUTE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  TIER_MESSAGE,
} from "./copy";

type Row = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
};

const { requirePermission, AccessDeniedError, revalidatePath, chatModel, db } =
  vi.hoisted(() => {
    class AccessDeniedError extends Error {}
    // An in-memory stand-in for the tables the action touches.
    const db = {
      conversations: [] as { id: number; userId: string; updatedAt: Date }[],
      messages: [] as Row[],
      profileRow: null as null | Record<string, unknown>,
      conversation: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => {
          const latest = db.conversations
            .filter((c) => c.userId === where.userId)
            .at(-1);
          if (!latest) return null;
          return {
            id: latest.id,
            messages: db.messages
              .filter((m) => m.conversationId === latest.id)
              .toReversed(),
          };
        }),
        create: vi.fn(async ({ data }: { data: { userId: string } }) => {
          const row = {
            id: db.conversations.length + 1,
            userId: data.userId,
            updatedAt: new Date(),
          };
          db.conversations.push(row);
          return { id: row.id };
        }),
        update: vi.fn(
          async ({ where }: { where: { id: number; userId: string } }) => {
            const row = db.conversations.find(
              (c) => c.id === where.id && c.userId === where.userId,
            );
            if (!row) throw new Error("P2025 record not found");
            row.updatedAt = new Date();
            return { id: row.id };
          },
        ),
      },
      message: {
        createMany: vi.fn(
          async ({ data }: { data: Omit<Row, "id" | "createdAt">[] }) => {
            for (const m of data) {
              db.messages.push({
                id: db.messages.length + 1,
                createdAt: new Date(),
                ...m,
              });
            }
            return { count: data.length };
          },
        ),
        // The user's own messages of one role since a time (the rate cap's query).
        count: vi.fn(
          async ({
            where,
          }: {
            where: {
              role: string;
              conversation: { userId: string };
              createdAt: { gte: Date };
            };
          }) => {
            const own = new Set(
              db.conversations
                .filter((c) => c.userId === where.conversation.userId)
                .map((c) => c.id),
            );
            return db.messages.filter(
              (m) =>
                own.has(m.conversationId) &&
                m.role === where.role &&
                m.createdAt >= where.createdAt.gte,
            ).length;
          },
        ),
      },
      profile: { findUnique: vi.fn(async () => db.profileRow) },
      plan: { findFirst: vi.fn(async () => null) },
      workout: { count: vi.fn(async () => 0) },
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work(db),
      ),
    };
    return {
      requirePermission: vi.fn(),
      AccessDeniedError,
      revalidatePath: vi.fn(),
      chatModel: vi.fn(),
      db,
    };
  });

vi.mock("@/lib/auth/access", () => ({ requirePermission, AccessDeniedError }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/coach/providers", () => ({ coachChatModel: () => chatModel }));
import { sendCoachMessage, type CoachActionState } from "./actions";
import { coachAttempts } from "./limits";

const idle: CoachActionState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  coachAttempts.clear();
  db.conversations.length = 0;
  db.messages.length = 0;
  db.profileRow = {
    goal: "MUSCLE",
    level: "BEGINNER",
    daysPerWeek: 3,
    equipment: ["dumbbell"],
    injuries: null,
  };
  requirePermission.mockResolvedValue({ user: { id: "owner" } });
  chatModel.mockResolvedValue(
    "Keep the dumbbell press at 3 x 10 and rest 90 seconds.",
  );
  delete process.env.GROQ_API_KEY;
});

describe("sendCoachMessage", () => {
  it("saves the message and the coach reply to the session owner's conversation", async () => {
    const result = await sendCoachMessage(
      idle,
      form({
        message: "How long should I rest between sets?",
        userId: "victim",
      }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(chatModel).toHaveBeenCalledTimes(1);
    expect(db.conversations).toMatchObject([{ userId: "owner" }]);
    expect(db.messages.map((m) => [m.role, m.content])).toEqual([
      ["USER", "How long should I rest between sets?"],
      ["ASSISTANT", "Keep the dumbbell press at 3 x 10 and rest 90 seconds."],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/coach");
  });

  it("answers a pain report with the fixed safe reply and never calls the model", async () => {
    const result = await sendCoachMessage(
      idle,
      form({ message: "I felt a sharp pain in my knee during squats" }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(chatModel).not.toHaveBeenCalled();
    const reply = db.messages.at(-1);
    expect(reply?.role).toBe("ASSISTANT");
    expect(Object.values(REPLIES)).toContain(reply?.content);
  });

  it("answers a request for a diagnosis with the fixed reply, not the model", async () => {
    await sendCoachMessage(
      idle,
      form({ message: "Do I have a torn meniscus?" }),
    );

    expect(chatModel).not.toHaveBeenCalled();
    expect(Object.values(REPLIES)).toContain(db.messages.at(-1)?.content);
  });

  it("gives a free account the tier message and saves nothing", async () => {
    requirePermission.mockRejectedValue(new AccessDeniedError());

    const result = await sendCoachMessage(idle, form({ message: "Hi coach" }));

    expect(result).toMatchObject({ status: "error" });
    expect(result).toEqual({ status: "error", message: TIER_MESSAGE });
    expect(chatModel).not.toHaveBeenCalled();
    expect(db.messages).toHaveLength(0);
  });

  it("lets a sign-in redirect through instead of swallowing it", async () => {
    requirePermission.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(
      sendCoachMessage(idle, form({ message: "Hi" })),
    ).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(db.messages).toHaveLength(0);
  });

  it("asks for a message when the box is empty, without saving or calling the model", async () => {
    const result = await sendCoachMessage(idle, form({ message: "   " }));

    expect(result).toMatchObject({ status: "error" });
    expect(chatModel).not.toHaveBeenCalled();
    expect(db.messages).toHaveLength(0);
  });

  it("sends the quiz first when the user has no profile yet", async () => {
    db.profileRow = null;

    const result = await sendCoachMessage(idle, form({ message: "Hi coach" }));

    expect(result).toMatchObject({ status: "error" });
    expect(result).toEqual({ status: "error", message: NO_PROFILE_MESSAGE });
    expect(chatModel).not.toHaveBeenCalled();
  });

  it("sends a quick reply when the text box is empty", async () => {
    const result = await sendCoachMessage(
      idle,
      form({ message: "", quickReply: "Too easy" }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(db.messages[0]).toMatchObject({ role: "USER", content: "Too easy" });
  });

  it("sends the quick reply that was pressed, even with text in the box", async () => {
    await sendCoachMessage(
      idle,
      form({ message: "half-typed question", quickReply: "Too hard" }),
    );

    expect(db.messages[0]).toMatchObject({ role: "USER", content: "Too hard" });
  });

  it("saves nothing and offers a retry when no provider answers", async () => {
    chatModel.mockRejectedValue(new Error("groq returned HTTP 503"));

    const result = await sendCoachMessage(
      idle,
      form({ message: "How long should I rest?" }),
    );

    expect(result).toEqual({
      status: "unsaved",
      text: "How long should I rest?",
      message: UNAVAILABLE_REPLY,
    });
    expect(db.messages).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the reply as not saved and offers a retry when saving fails", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("connection refused"));

    const result = await sendCoachMessage(
      idle,
      form({ message: "How long should I rest?" }),
    );

    expect(result).toEqual({
      status: "unsaved",
      text: "How long should I rest?",
      reply: "Keep the dumbbell press at 3 x 10 and rest 90 seconds.",
      message: SAVE_FAILED_MESSAGE,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("gives the model the saved conversation, oldest first, as user and assistant turns", async () => {
    db.conversations.push({ id: 1, userId: "owner", updatedAt: new Date() });
    const earlier = new Date(Date.now() - 3_600_000);
    db.messages.push(
      {
        id: 1,
        conversationId: 1,
        role: "USER",
        content: "first question about squats",
        createdAt: earlier,
      },
      {
        id: 2,
        conversationId: 1,
        role: "ASSISTANT",
        content: "first answer about squats",
        createdAt: earlier,
      },
    );

    await sendCoachMessage(idle, form({ message: "How many sets of squats?" }));

    const sent = chatModel.mock.calls[0][0] as {
      role: string;
      content: string;
    }[];
    expect(sent[0].role).toBe("system");
    expect(sent.slice(1)).toEqual([
      { role: "user", content: "first question about squats" },
      { role: "assistant", content: "first answer about squats" },
      { role: "user", content: "How many sets of squats?" },
    ]);
  });

  it("offers a retry instead of the error page when the conversation cannot be loaded", async () => {
    db.profile.findUnique.mockRejectedValueOnce(
      new Error("connection refused"),
    );

    const result = await sendCoachMessage(
      idle,
      form({ message: "How long should I rest?" }),
    );

    expect(result).toEqual({
      status: "unsaved",
      text: "How long should I rest?",
      message: LOAD_FAILED_MESSAGE,
    });
    expect(chatModel).not.toHaveBeenCalled();
  });

  it("refuses a sixth message within a minute, before any model call", async () => {
    db.conversations.push({ id: 1, userId: "owner", updatedAt: new Date() });
    for (let i = 0; i < 5; i++) {
      db.messages.push({
        id: i + 1,
        conversationId: 1,
        role: "USER",
        content: `q${i}`,
        createdAt: new Date(),
      });
    }

    const result = await sendCoachMessage(idle, form({ message: "One more?" }));

    expect(result).toEqual({ status: "error", message: RATE_MINUTE_MESSAGE });
    expect(chatModel).not.toHaveBeenCalled();
    expect(db.messages).toHaveLength(5);
  });

  it("refuses a message past the daily cap", async () => {
    db.conversations.push({ id: 1, userId: "owner", updatedAt: new Date() });
    const earlier = new Date(Date.now() - 2 * 3_600_000);
    for (let i = 0; i < 50; i++) {
      db.messages.push({
        id: i + 1,
        conversationId: 1,
        role: "USER",
        content: `q${i}`,
        createdAt: earlier,
      });
    }

    const result = await sendCoachMessage(idle, form({ message: "One more?" }));

    expect(result).toEqual({ status: "error", message: RATE_DAY_MESSAGE });
    expect(chatModel).not.toHaveBeenCalled();
  });

  it("does not count another user's messages against the cap", async () => {
    db.conversations.push({
      id: 1,
      userId: "someone-else",
      updatedAt: new Date(),
    });
    for (let i = 0; i < 5; i++) {
      db.messages.push({
        id: i + 1,
        conversationId: 1,
        role: "USER",
        content: `q${i}`,
        createdAt: new Date(),
      });
    }

    const result = await sendCoachMessage(
      idle,
      form({ message: "How long should I rest?" }),
    );

    expect(result).toEqual({ status: "sent" });
  });

  it("lets only five of six parallel sends reach the model", async () => {
    const sends = ["a", "b", "c", "d", "e", "f"].map((q) =>
      sendCoachMessage(
        idle,
        form({ message: `How many sets of squats, ${q}?` }),
      ),
    );

    const results = await Promise.all(sends);

    expect(chatModel).toHaveBeenCalledTimes(5);
    expect(results).toContainEqual({
      status: "error",
      message: RATE_MINUTE_MESSAGE,
    });
  });

  it("counts sends that failed after a model call against the cap", async () => {
    chatModel.mockRejectedValue(new Error("groq returned HTTP 503"));
    for (const q of ["a", "b", "c", "d", "e"]) {
      await sendCoachMessage(
        idle,
        form({ message: `How many sets of squats, ${q}?` }),
      );
    }

    const sixth = await sendCoachMessage(
      idle,
      form({ message: "How many sets of squats?" }),
    );

    expect(sixth).toEqual({ status: "error", message: RATE_MINUTE_MESSAGE });
    expect(chatModel).toHaveBeenCalledTimes(5);
  });
});
