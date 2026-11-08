// Checks the root page is built from the shadcn/ui Card and button styles and still links to the quiz.
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

describe("root page", () => {
  it("has exactly one h1, naming the product", () => {
    const headings = [...render().matchAll(/<h1[^>]*>(.*?)<\/h1>/g)];
    expect(headings).toHaveLength(1);
    expect(headings[0][1]).toBe("FORM");
  });

  it("keeps the tagline", () => {
    expect(render()).toContain(
      "A fitness coach for a routine that fits your life.",
    );
  });

  it("has one link, named Start your quiz, to /onboarding", () => {
    const found = links(render());
    expect(found).toHaveLength(1);
    expect(found[0].href).toBe("/onboarding");
    expect(found[0].text).toBe("Start your quiz");
  });

  it("renders inside the shadcn Card", () => {
    expect(render()).toContain('data-slot="card"');
  });

  it("styles the link as the primary button with no conflicting padding or height", () => {
    const { classes } = links(render())[0];
    expect(classes).toEqual(
      expect.arrayContaining(["bg-primary", "text-primary-foreground"]),
    );
    const paddingX = classes.filter((c) => /^px-/.test(c));
    const height = classes.filter((c) => /^h-\d/.test(c));
    expect(paddingX).toHaveLength(1);
    expect(height.length).toBeLessThanOrEqual(1);
  });
});
