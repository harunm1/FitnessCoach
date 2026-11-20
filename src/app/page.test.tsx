// Checks the root page is built from the shadcn/ui Card and button styles, links to the quiz and keeps the account links beside it.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

function render(): string {
  return renderToStaticMarkup(<Home />);
}

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

// The quiz link, found by where it goes, so the account links can come after it.
function quizLink() {
  const link = links(render()).find((l) => l.href === "/onboarding");
  if (!link) throw new Error("The root page has no link to /onboarding");
  return link;
}

describe("root page", () => {
  it("has exactly one h1, naming the product", () => {
    const headings = [...render().matchAll(/<h1[^>]*>(.*?)<\/h1>/g)];
    expect(headings).toHaveLength(1);
    expect(headings[0][1].replace(/<[^>]*>/g, "")).toBe("FORM");
  });

  it("keeps the tagline", () => {
    expect(render()).toContain(
      "A fitness coach for a routine that fits your life.",
    );
  });

  it("links to the quiz first, then to Create account and Sign in", () => {
    const found = links(render()).map(({ href, text }) => ({ href, text }));
    expect(found).toEqual([
      { href: "/onboarding", text: "Start your quiz" },
      { href: "/sign-up", text: "Create account" },
      { href: "/sign-in", text: "Sign in" },
    ]);
  });

  it("puts the heading, the quiz link and the account links inside the shadcn Card", () => {
    const card = cardMarkup(render());
    expect(card).toContain("<h1");
    for (const href of ["/onboarding", "/sign-up", "/sign-in"]) {
      expect(card).toContain(`href="${href}"`);
    }
  });

  it("styles only the quiz link as a button; the account links stay plain underlined text", () => {
    const found = links(render());
    const account = found.filter((l) => l.href !== "/onboarding");
    expect(account).toHaveLength(2);
    for (const { classes } of account) {
      expect(classes).toContain("underline");
      expect(classes.filter((c) => /^bg-/.test(c))).toEqual([]);
    }
  });

  it("styles the link as the primary button with no conflicting padding or height", () => {
    const { classes } = quizLink();
    expect(classes).toEqual(
      expect.arrayContaining(["bg-primary", "text-primary-foreground"]),
    );
    const paddingX = classes.filter((c) => /^px-/.test(c));
    const height = classes.filter((c) => /^h-\d/.test(c));
    expect(paddingX).toHaveLength(1);
    expect(height.length).toBeLessThanOrEqual(1);
  });

  it("keeps a 44px touch target on the link (h-11, not the lg size's h-9)", () => {
    expect(quizLink().classes).toContain("h-11");
  });
});
