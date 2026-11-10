// The /coach page (#63): the conversation for an account with coach access, the tier message otherwise.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccount, loadConversation } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  loadConversation: vi.fn(),
}));
vi.mock("@/lib/auth/access", () => ({ requireAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/coach/conversation", () => ({ loadConversation }));
vi.mock("./actions", () => ({ sendCoachMessage: vi.fn() }));
import CoachPage from "./page";
import { TIER_MESSAGE } from "./copy";

beforeEach(() => {
  vi.clearAllMocks();
  loadConversation.mockResolvedValue({
    id: 7,
    messages: [{ id: 1, role: "USER", content: "How long should I rest?" }],
  });
});

describe("coach page", () => {
  it("shows the saved conversation and the form when the account has coach access", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["coach"] },
    });

    const html = renderToStaticMarkup(await CoachPage());

    expect(loadConversation).toHaveBeenCalledWith({}, "owner");
    expect(html).toContain("How long should I rest?");
    expect(html).toContain('name="message"');
  });

  it("shows the tier message, not the chat, to a free account", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["quiz", "default-plan", "tracking"] },
    });

    const html = renderToStaticMarkup(await CoachPage());

    expect(html).toContain(TIER_MESSAGE);
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('name="message"');
    expect(loadConversation).not.toHaveBeenCalled();
  });
});
