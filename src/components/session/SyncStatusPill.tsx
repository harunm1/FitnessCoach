// The small sync status in the session view (D31). Silent while online with nothing to
// sync; otherwise a polite live region, and an alert with real buttons when a set failed.

export type SyncStatusPillProps = {
  online: boolean;
  pending: number;
  syncing: boolean;
  justSynced: boolean;
  failure: { message: string } | null; // a set the server refused
  onRetry: () => void;
  onDiscard: () => void;
};

type Tone = "failed" | "offline" | "online";

const TONE_CLASS: Record<Tone, string> = {
  failed: "border-red-800/40 bg-red-50 text-red-900",
  offline: "border-amber-800/40 bg-amber-50 text-amber-950",
  online: "border-emerald-800/30 bg-emerald-50 text-emerald-900",
};

const SINGLE = 1;

function setsLabel(count: number): string {
  return count === SINGLE ? "1 set" : `${count} sets`;
}

function statusText({
  online,
  pending,
  syncing,
  justSynced,
}: SyncStatusPillProps): string | null {
  if (syncing && pending > 0) return `Syncing ${setsLabel(pending)}…`;
  if (pending > 0) return `Saved offline, ${pending} to sync`;
  if (!online) return "Sets you log are kept on this device.";
  if (justSynced) return "All sets synced";
  return null;
}

function toneOf(props: SyncStatusPillProps): Tone {
  if (props.failure) return "failed";
  return props.online ? "online" : "offline";
}

const buttonClassName =
  "min-h-8 border border-current px-2 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

export default function SyncStatusPill(props: SyncStatusPillProps) {
  const text = statusText(props);
  if (!text && !props.failure) return null;

  return (
    <div
      className={`mb-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm ${TONE_CLASS[toneOf(props)]}`}
    >
      <p aria-live="polite" className="m-0" role="status">
        {!props.online && <strong className="font-semibold">Offline. </strong>}
        {text}
      </p>
      {props.failure && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <span>Could not sync a set: {props.failure.message}</span>
          <button
            className={buttonClassName}
            onClick={props.onRetry}
            type="button"
          >
            Try again
          </button>
          <button
            className={buttonClassName}
            onClick={props.onDiscard}
            type="button"
          >
            Discard this set
          </button>
        </div>
      )}
    </div>
  );
}
