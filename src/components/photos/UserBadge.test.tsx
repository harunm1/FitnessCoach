import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserBadge } from "./UserBadge";

describe("UserBadge", () => {
  it("shows the name and profile photo", () => {
    const html = renderToStaticMarkup(
      <UserBadge name="Free Demo" imageUrl="https://example.com/me.png" />,
    );
    expect(html).toContain("Free Demo");
    expect(html).toContain('src="https://example.com/me.png"');
    expect(html).not.toContain('data-testid="avatar-icon"');
  });

  it("shows a person icon when there is no profile photo", () => {
    const html = renderToStaticMarkup(
      <UserBadge name="Free Demo" imageUrl={null} />,
    );
    expect(html).toContain("Free Demo");
    expect(html).toContain('data-testid="avatar-icon"');
    expect(html).not.toContain("<img");
  });

  it("links to the account page, where the user can sign out", () => {
    const html = renderToStaticMarkup(
      <UserBadge name="Free Demo" imageUrl={null} />,
    );
    expect(html).toContain('href="/account"');
    expect(html).toContain('aria-label="Your account (Free Demo)"');
  });

  it("hides the picture from screen readers, since the name is right beside it", () => {
    const html = renderToStaticMarkup(
      <UserBadge name="Free Demo" imageUrl="https://example.com/me.png" />,
    );
    expect(html).toContain('alt=""');
  });
});
