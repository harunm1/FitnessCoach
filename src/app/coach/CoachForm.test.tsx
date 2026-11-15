// The coach message form (#63): a labelled box, a send button and a status line for errors.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ sendCoachMessage: vi.fn() }));
import { MAX_MESSAGE_CHARS } from "@/lib/coach/chat";
import CoachForm from "./CoachForm";
import { MESSAGE_MAX_LENGTH } from "./copy";

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

  it("stops the message box at the length the coach answers", () => {
    const html = renderToStaticMarkup(<CoachForm />);
    const textarea = html.slice(html.indexOf("<textarea"));

    expect(textarea.slice(0, textarea.indexOf(">"))).toContain(
      `maxLength="${MESSAGE_MAX_LENGTH}"`,
    );
    expect(MESSAGE_MAX_LENGTH).toBe(MAX_MESSAGE_CHARS);
  });
});
