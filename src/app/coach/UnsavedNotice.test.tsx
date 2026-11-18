// The unsaved-retry notice (#63, #42): what went wrong, any reply marked as not saved, and one button to send the same text again.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import UnsavedNotice from "./UnsavedNotice";

// The opening tag of the first <button> whose text is the label.
function buttonTag(html: string, label: string): string {
  const end = html.indexOf(`>${label}</button>`);
  const start = html.lastIndexOf("<button", end);
  return end === -1 || start === -1 ? "" : html.slice(start, end + 1);
}

describe("UnsavedNotice", () => {
  it("explains, shows the unsaved reply and resends the same text", () => {
    const html = renderToStaticMarkup(
      <UnsavedNotice
        action={() => {}}
        message="Your message and the reply were not saved."
        reply="Rest 90 seconds."
        text="How long should I rest?"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Your message and the reply were not saved.");
    expect(html.indexOf("Not saved")).toBeGreaterThan(-1);
    expect(html.indexOf("Not saved")).toBeLessThan(
      html.indexOf("Rest 90 seconds."),
    );
    const button = buttonTag(html, "Send again");
    expect(button).toContain('name="message"');
    expect(button).toContain('type="submit"');
    expect(button).toContain('value="How long should I rest?"');
    // Its own form, so nothing from the message box is sent with it.
    const form = html.slice(html.lastIndexOf("<form", html.indexOf(button)));
    expect(form.startsWith("<form")).toBe(true);
    expect(form.indexOf("<textarea")).toBe(-1);
  });

  it("leaves out the reply block when there is no reply", () => {
    const html = renderToStaticMarkup(
      <UnsavedNotice
        action={() => {}}
        message="The coach can't answer right now."
        text="Hi"
      />,
    );

    expect(html).not.toContain("Not saved");
    expect(html).toContain("Send again");
  });
});
