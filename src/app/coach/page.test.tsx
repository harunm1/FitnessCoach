// The /coach page (#63): the conversation for an account with coach access, the tier message otherwise.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccount, loadConversation, hasProfile, loadAvatarUrl } =
  vi.hoisted(() => ({
    requireAccount: vi.fn(),
    loadConversation: vi.fn(),
    hasProfile: vi.fn(),
    loadAvatarUrl: vi.fn(),
  }));
vi.mock("@/lib/auth/access", () => ({ requireAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/coach/conversation", () => ({ loadConversation, hasProfile }));
vi.mock("@/lib/photos/avatar", () => ({ loadAvatarUrl }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./personalize-action", () => ({ personalizeWithCoach: vi.fn() }));
import CoachPage from "./page";
import { NO_PROFILE_MESSAGE, PERSONALIZE_INTRO, TIER_MESSAGE } from "./copy";

beforeEach(() => {
  vi.clearAllMocks();
  hasProfile.mockResolvedValue(true);
  loadAvatarUrl.mockResolvedValue(null);
  loadConversation.mockResolvedValue({
    id: 7,
    messages: [{ id: 1, role: "USER", content: "How long should I rest?" }],
  });
});

describe("coach page", () => {
  it("shows the nav bar with Coach as the current page", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner", name: "Free Demo" },
      access: { permissions: ["coach"] },
    });

    const html = renderToStaticMarkup(await CoachPage());

    expect(html).toContain('<nav aria-label="Main"');
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/coach"/);
    expect(loadAvatarUrl).toHaveBeenCalledWith("owner");
  });

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

  it("sends a user with no profile to the quiz instead of showing the form", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["coach"] },
    });
    hasProfile.mockResolvedValue(false);

    const html = renderToStaticMarkup(await CoachPage());

    expect(hasProfile).toHaveBeenCalledWith({}, "owner");
    expect(html).toContain(NO_PROFILE_MESSAGE);
    expect(html).toContain('href="/onboarding"');
    expect(html).not.toContain('name="message"');
  });

  it("puts Personalize with the coach, with its one-line explanation, above the chat (demo step 5)", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["coach"] },
    });

    const html = renderToStaticMarkup(await CoachPage());

    expect(PERSONALIZE_INTRO).toBe(
      "Rebuild this week from your profile and history.",
    );
    expect(html).toContain(PERSONALIZE_INTRO);
    expect(html).toContain("Personalize with the coach");
    expect(html.indexOf("Personalize with the coach")).toBeLessThan(
      html.indexOf('name="message"'),
    );
  });

  it("does not show Personalize with the coach on the tier or quiz messages", async () => {
    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["quiz", "default-plan", "tracking"] },
    });
    expect(renderToStaticMarkup(await CoachPage())).not.toContain(
      "Personalize with the coach",
    );

    requireAccount.mockResolvedValue({
      user: { id: "owner" },
      access: { permissions: ["coach"] },
    });
    hasProfile.mockResolvedValue(false);
    expect(renderToStaticMarkup(await CoachPage())).not.toContain(
      "Personalize with the coach",
    );
  });
});
