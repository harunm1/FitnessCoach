// Checks the root page is built from the shadcn/ui Card and button styles, leads with Get started and keeps Sign in beside it, and sends signed-in users to their session.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVerifiedUser, redirect } = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser }));
vi.mock("next/navigation", () => ({ redirect }));
import Home from "./page";

// The page as a signed-out visitor sees it.
let html = "";
async function load(): Promise<string> {
  return renderToStaticMarkup(await Home());
}
function render(): string {
  return html;
}

beforeEach(async () => {
  vi.clearAllMocks();
  getVerifiedUser.mockResolvedValue(null);
  html = await load();
});

// Every <a> in the markup as { href, text, classes }.
function links(html: string) {
  return [...html.matchAll(/<a([^>]*)>(.*?)<\/a>/g)].map(([, attrs, text]) => ({
    href: attrs.match(/href="([^"]*)"/)?.[1] ?? null,
    text: text.replace(/<[^>]*>/g, "").trim(),
    classes: (attrs.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/),
  }));
}

// The markup between the Card's opening <div> and its matching </div>, so a test can
// tell what is inside the Card from what merely comes after it.
function cardMarkup(html: string): string {
  const slot = html.indexOf('data-slot="card"');
  const start = html.lastIndexOf("<div", slot);
  let depth = 0;
  for (const tag of html.slice(start).matchAll(/<(\/?)div\b/g)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) {
      const close = html.indexOf(">", start + tag.index) + 1;
      return html.slice(start, close);
    }
  }
  throw new Error("The Card's <div> is never closed");
}

// The Get started link, found by where it goes, so Sign in can come after it.
function startLink() {
  const link = links(render()).find((l) => l.href === "/sign-up");
  if (!link) throw new Error("The root page has no link to /sign-up");
  return link;
}

describe("root page", () => {
  it("has exactly one h1, naming the product", () => {
    const headings = [...render().matchAll(/<h1[^>]*>(.*?)<\/h1>/g)];
    expect(headings).toHaveLength(1);
    expect(headings[0][1].replace(/<[^>]*>/g, "")).toBe("FitnessCoach");
  });

  it("keeps the tagline", () => {
    expect(render()).toContain(
      "A fitness coach for a routine that fits your life.",
    );
  });

  it("links to Get started first, then to Sign in", () => {
    const found = links(render()).map(({ href, text }) => ({ href, text }));
    expect(found).toEqual([
      { href: "/sign-up", text: "Get started" },
      { href: "/sign-in", text: "Sign in" },
    ]);
  });

  it("puts the heading, Get started and Sign in inside the shadcn Card", () => {
    const card = cardMarkup(render());
    expect(card).toContain("<h1");
    for (const href of ["/sign-up", "/sign-in"]) {
      expect(card).toContain(`href="${href}"`);
    }
  });

  it("styles only Get started as a button; Sign in stays plain underlined text", () => {
    const found = links(render());
    const account = found.filter((l) => l.href !== "/sign-up");
    expect(account).toHaveLength(1);
    for (const { classes } of account) {
      expect(classes).toContain("underline");
      expect(classes.filter((c) => /^bg-/.test(c))).toEqual([]);
    }
  });

  it("styles the link as the primary button with no conflicting padding or height", () => {
    const { classes } = startLink();
    expect(classes).toEqual(
      expect.arrayContaining(["bg-primary", "text-primary-foreground"]),
    );
    const paddingX = classes.filter((c) => /^px-/.test(c));
    const height = classes.filter((c) => /^h-\d/.test(c));
    expect(paddingX).toHaveLength(1);
    expect(height.length).toBeLessThanOrEqual(1);
  });

  it("keeps a 44px touch target on the link (h-11, not the lg size's h-9)", () => {
    expect(startLink().classes).toContain("h-11");
  });

  it("sends a signed-in user to their session instead", async () => {
    getVerifiedUser.mockResolvedValue({ id: "u1", name: "Free Demo" });
    await expect(load()).rejects.toThrow("redirect:/session");
    expect(redirect).toHaveBeenCalledWith("/session");
  });
});
