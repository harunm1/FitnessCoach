// The coach message form (#63): a labelled box, a send button and a status line for errors.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ sendCoachMessage: vi.fn() }));
import CoachForm from "./CoachForm";

describe("CoachForm", () => {
  it("renders a labelled message box and a send button", () => {
    const html = renderToStaticMarkup(<CoachForm />);

    const id = html.match(/<textarea[^>]*id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('name="message"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Send<\/button>/);
  });
});
