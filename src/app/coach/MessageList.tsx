// The saved conversation (#63), oldest first, in a live log so a screen reader reads each new reply.
import type { StoredMessage } from "@/lib/coach/conversation";

type MessageListProps = { messages: StoredMessage[] };

export default function MessageList({ messages }: MessageListProps) {
  return (
    <ol
      aria-label="Conversation with the coach"
      aria-live="polite"
      className="m-0 flex list-none flex-col gap-3 p-0"
      role="log"
    >
      {messages.length === 0 ? (
        <li className="text-sm text-foreground/70">
          No messages yet. Ask about your next session to get started.
        </li>
      ) : (
        messages.map((message) => (
          <li
            className={
              message.role === "USER"
                ? "ml-8 rounded-lg bg-foreground/10 px-4 py-3"
                : "mr-8 rounded-lg border border-foreground/15 px-4 py-3"
            }
            key={message.id}
          >
            <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/70 uppercase">
              {message.role === "USER" ? "You" : "Coach"}
            </p>
            <p className="mt-1 mb-0 text-sm leading-6 whitespace-pre-line">
              {message.content}
            </p>
          </li>
        ))
      )}
    </ol>
  );
}
