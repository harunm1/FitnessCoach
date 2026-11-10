// The coach message form (#63): a labelled box, a send button and a status line for errors.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ sendCoachMessage: vi.fn() }));
import CoachForm from "./CoachForm";

describe("CoachForm", () => {
  it("renders a labelled message box and a send button", () => {
    const html = renderToStaticMarkup(<CoachForm />);

    const textarea = html.slice(html.indexOf("<textarea"));
    const idStart = textarea.indexOf('id="') + 'id="'.length;
    const id = textarea.slice(idStart, textarea.indexOf('"', idStart));
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('name="message"');
    const send = html.slice(
      html.lastIndexOf("<button", html.indexOf(">Send</button>")),
      html.indexOf(">Send</button>"),
    );
    expect(send).toContain('type="submit"');
  });
});
