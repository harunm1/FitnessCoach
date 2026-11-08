// Checks the root page is built from the shadcn/ui Card and button styles and still links to the quiz.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

function render(): string {
  return renderToStaticMarkup(<Home />);
}

// Class list of the first <a> pointing at `href`, or null when there is none.
function linkClasses(html: string, href: string): string[] | null {
  const anchor = html.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`));
  const classAttr = anchor?.[0].match(/class="([^"]*)"/);
  return classAttr ? classAttr[1].split(/\s+/) : null;
}

describe("root page", () => {
  it("keeps the product name, tagline and quiz call to action", () => {
    const html = render();
    expect(html).toContain("FORM");
    expect(html).toContain(
      "A fitness coach for a routine that fits your life.",
    );
    expect(html).toContain("Start your quiz");
  });

  it("renders its content inside the shadcn Card", () => {
    expect(render()).toContain('data-slot="card"');
  });

  it("styles the quiz link with shadcn buttonVariants (default variant)", () => {
    const classes = linkClasses(render(), "/onboarding");
    expect(classes).not.toBeNull();
    expect(classes).toEqual(
      expect.arrayContaining(["bg-primary", "text-primary-foreground"]),
    );
  });
});
