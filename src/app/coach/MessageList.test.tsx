// The conversation list (#63): a labelled live log, oldest first, with who said each message.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MessageList from "./MessageList";

describe("MessageList", () => {
  it("renders the messages oldest first in a polite live log", () => {
    const html = renderToStaticMarkup(
      <MessageList
        messages={[
          { id: 1, role: "USER", content: "Can I swap squats for lunges?" },
          { id: 2, role: "ASSISTANT", content: "Yes, 3 x 10 per leg." },
        ]}
      />,
    );

    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Conversation with the coach"');
    expect(html.indexOf("Can I swap squats")).toBeLessThan(
      html.indexOf("Yes, 3 x 10"),
    );
    expect(html).toMatch(
      /You[\s\S]*Can I swap squats[\s\S]*Coach[\s\S]*Yes, 3 x 10/,
    );
  });

  it("shows how to start when there are no messages yet", () => {
    const html = renderToStaticMarkup(<MessageList messages={[]} />);

    expect(html).toContain("No messages yet");
    expect(html).toContain('role="log"');
  });

  it("escapes message text instead of rendering it as markup", () => {
    const html = renderToStaticMarkup(
      <MessageList
        messages={[
          { id: 1, role: "USER", content: "<img src=x onerror=alert(1)>" },
        ]}
      />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
