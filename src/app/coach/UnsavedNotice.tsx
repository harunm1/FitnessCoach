// The unsaved-retry notice (#63, #42): what went wrong, any reply marked as not saved, and a button that sends the same text again.
type UnsavedNoticeProps = {
  // The form action from useActionState, so a retry goes through the same Server Action.
  action: (formData: FormData) => void;
  message: string;
  text: string;
  reply?: string;
};

// Its own form, outside the message box's form, so the resent text is the only
// "message" field and nothing typed since is mixed in.
export default function UnsavedNotice({
  action,
  message,
  text,
  reply,
}: UnsavedNoticeProps) {
  return (
    <div
      className="mt-6 rounded-lg border border-foreground/25 px-4 py-3"
      role="alert"
    >
      <p className="m-0 text-sm leading-6">{message}</p>
      {reply ? (
        <div className="mt-3">
          <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/55 uppercase">
            Not saved
          </p>
          <p className="mt-1 mb-0 text-sm leading-6 whitespace-pre-line">
            {reply}
          </p>
        </div>
      ) : null}
      <form action={action} className="mt-3">
        <button
          className="min-h-12 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          name="message"
          type="submit"
          value={text}
        >
          Send again
        </button>
      </form>
    </div>
  );
}
