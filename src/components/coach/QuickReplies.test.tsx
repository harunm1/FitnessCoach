// Quick-reply buttons (#63, reused by #60): each submits its own text with the surrounding form.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuickReplies, { QUICK_REPLIES } from "./QuickReplies";

describe("QuickReplies", () => {
  it("offers the three standard replies", () => {
    expect(QUICK_REPLIES).toEqual([
      "Swap this exercise",
      "Too easy",
      "Too hard",
    ]);
  });

  it("renders one submit button per reply, sent as quickReply, skipping the text box's required check", () => {
    const html = renderToStaticMarkup(<QuickReplies />);
    // Each piece after "<button" is one button's attributes and label.
    const buttons = html.split("<button").slice(1);

    expect(buttons).toHaveLength(3);
    for (const [i, text] of QUICK_REPLIES.entries()) {
      expect(buttons[i]).toContain('type="submit"');
      expect(buttons[i]).toContain('name="quickReply"');
      expect(buttons[i]).toContain(`value="${text}"`);
      expect(buttons[i]).toContain("formNoValidate");
    }
  });

  it("takes another set of replies and can be disabled while a reply is pending", () => {
    const html = renderToStaticMarkup(
      <QuickReplies disabled replies={["Log a run"]} />,
    );

    expect(html).toContain('value="Log a run"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="Quick replies"');
  });
});
