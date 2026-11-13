// Quick-reply buttons for the coach (#63), built for reuse in the body-map panel (#60): each one submits its text with the form around it.
export const QUICK_REPLIES = [
  "Swap this exercise",
  "Too easy",
  "Too hard",
] as const;

type QuickRepliesProps = {
  replies?: readonly string[];
  disabled?: boolean;
};

// Sent as "quickReply", not "message", so the pressed button wins over any typed text;
// formNoValidate lets a button send while the text box is still empty.
export default function QuickReplies({
  replies = QUICK_REPLIES,
  disabled = false,
}: QuickRepliesProps) {
  return (
    <div
      aria-label="Quick replies"
      className="flex flex-wrap gap-2"
      role="group"
    >
      {replies.map((reply) => (
        <button
          className="min-h-12 rounded-full border border-foreground/25 px-4 text-sm font-semibold transition-colors hover:bg-foreground/10 disabled:opacity-50"
          disabled={disabled}
          formNoValidate
          key={reply}
          name="quickReply"
          type="submit"
          value={reply}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
