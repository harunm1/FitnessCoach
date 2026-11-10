// The coach Server Action (#63): one exchange saved for the session owner, guardrails before any model call.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPLIES } from "@/lib/coach/guardrails";

type Row = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
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
        createMany: vi.fn(async ({ data }: { data: Omit<Row, "id">[] }) => {
          for (const m of data) {
            db.messages.push({ id: db.messages.length + 1, ...m });
          }
          return { count: data.length };
        }),
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

const idle: CoachActionState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(result.status === "error" && result.message).toMatch(/trial|Pro/i);
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
    expect(result.status === "error" && result.message).toMatch(/quiz/i);
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
});
