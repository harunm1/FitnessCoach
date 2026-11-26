// The bar fixed to the bottom of the workout page (D43): the clock, Pause or Resume, and
// Finish workout, always in view, so Finish needs no scrolling on a long workout or a phone.
import { finishWorkout } from "@/app/session/actions";
import ActiveWorkoutClock from "./ActiveWorkoutClock";

type WorkoutBarProps = {
  workoutId: number;
  bankedSeconds: number;
  activeSinceIso: string | null;
  lastSetAtIso: string | null;
  serverNowIso: string;
};

export default function WorkoutBar(props: WorkoutBarProps) {
  return (
    <div
      aria-label="Workout controls"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/20 bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      role="region"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ActiveWorkoutClock
          // A new key when the server's clock changes, so the client state restarts.
          key={`${props.bankedSeconds}-${props.activeSinceIso ?? "paused"}`}
          {...props}
          hideFinish
        />
        <form action={finishWorkout}>
          <button
            className="min-h-11 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
            type="submit"
          >
            Finish workout
          </button>
        </form>
      </div>
    </div>
  );
}
