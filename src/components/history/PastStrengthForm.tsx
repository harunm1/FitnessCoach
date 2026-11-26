"use client";

// The strength half of "Log a past workout" (D49, #194): a day, then exercises with their
// sets, sent as one entry. The browser limits are only hints; the Server Action checks
// every field again. The form is sent by hand, not as a form action, so React does not
// reset what was typed when the server refuses it.
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import {
  logPastStrength,
  type PastStrengthState,
} from "@/app/history/log/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayLabel } from "@/lib/progress/weightChart";
import { EARLIEST_RUN_DAY } from "@/lib/progress/runLimits";
import { weightLabel, type WeightUnit } from "@/lib/units/convert";
import {
  MAX_PAST_EXERCISES,
  MAX_PAST_MINUTES,
  MAX_PAST_NOTE_LENGTH,
  MAX_PAST_REPS,
  MAX_PAST_SETS,
} from "@/lib/workout/pastStrength";

type SetRow = { reps: string; weight: string };
type Block = { key: number; exerciseId: string; sets: SetRow[] };

const emptySet = (): SetRow => ({ reps: "", weight: "" });
const newBlock = (key: number): Block => ({
  key,
  exerciseId: "",
  sets: [emptySet()],
});

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function savedMessage(state: Extract<PastStrengthState, { status: "saved" }>) {
  return `Saved your workout for ${dayLabel(state.date)}: ${plural(state.exercises, "exercise")}, ${plural(state.sets, "set")}.`;
}

export function PastStrengthForm({
  exercises,
  today,
  weightUnit,
}: {
  exercises: { id: string; name: string }[];
  today: string;
  weightUnit: WeightUnit; // what the user chose (D30); the form posts it back
}) {
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([newBlock(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [state, setState] = useState<PastStrengthState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const changeBlock = (key: number, change: (block: Block) => Block) =>
    setBlocks((all) =>
      all.map((block) => (block.key === key ? change(block) : block)),
    );

  const addBlock = () => {
    setBlocks((all) => [...all, newBlock(nextKey)]);
    setNextKey(nextKey + 1);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set("weightUnit", weightUnit);
    data.set(
      "entry",
      JSON.stringify({
        date,
        minutes,
        note,
        exercises: blocks.map(({ exerciseId, sets }) => ({ exerciseId, sets })),
      }),
    );
    startTransition(async () => {
      const result = await logPastStrength({ status: "idle" }, data);
      setState(result);
      // Ready for the next workout on the same day; an error keeps everything typed.
      if (result.status === "saved") {
        setMinutes("");
        setNote("");
        setBlocks([newBlock(nextKey)]);
        setNextKey(nextKey + 1);
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-[auto_auto] sm:items-end sm:justify-start">
        <div className="grid gap-1">
          <Label htmlFor="past-date">Day</Label>
          <Input
            id="past-date"
            type="date"
            value={date}
            min={EARLIEST_RUN_DAY}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="past-minutes">Minutes (optional)</Label>
          <Input
            id="past-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_PAST_MINUTES}
            step={1}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="w-28"
          />
        </div>
      </div>

      {blocks.map((block, blockIndex) => {
        const name = `Exercise ${blockIndex + 1}`;
        return (
          <fieldset
            key={block.key}
            className="grid gap-3 border border-foreground/15 p-4"
          >
            <legend className="px-1 text-sm font-semibold">{name}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-0 flex-1 gap-1">
                <Label htmlFor={`past-exercise-${block.key}`}>{name}</Label>
                <select
                  id={`past-exercise-${block.key}`}
                  value={block.exerciseId}
                  onChange={(event) =>
                    changeBlock(block.key, (current) => ({
                      ...current,
                      exerciseId: event.target.value,
                    }))
                  }
                  className="h-10 w-full min-w-0 border border-input bg-background px-2 text-sm"
                  required
                >
                  <option value="">Choose an exercise</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </div>
              {blocks.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBlocks((all) => all.filter((b) => b.key !== block.key))
                  }
                  aria-label={`Remove ${name}`}
                >
                  Remove
                </Button>
              )}
            </div>

            {block.sets.map((set, setIndex) => {
              const setName = `${name}, set ${setIndex + 1}`;
              return (
                <div key={setIndex} className="flex flex-wrap items-end gap-3">
                  <span className="w-12 pb-2 text-sm text-foreground/70">
                    Set {setIndex + 1}
                  </span>
                  <div className="grid gap-1">
                    <span aria-hidden="true" className="text-sm">
                      Reps
                    </span>
                    <Input
                      aria-label={`${setName} reps`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_PAST_REPS}
                      step={1}
                      value={set.reps}
                      onChange={(event) =>
                        changeBlock(block.key, (current) => ({
                          ...current,
                          sets: current.sets.map((row, index) =>
                            index === setIndex
                              ? { ...row, reps: event.target.value }
                              : row,
                          ),
                        }))
                      }
                      className="w-20"
                      required
                    />
                  </div>
                  <div className="grid gap-1">
                    <span aria-hidden="true" className="text-sm">
                      Weight ({weightLabel(weightUnit)})
                    </span>
                    {/* Text, not number: some keyboards type "62,5", which the server accepts. */}
                    <Input
                      aria-label={`${setName} weight (${weightLabel(weightUnit)})`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="optional"
                      value={set.weight}
                      onChange={(event) =>
                        changeBlock(block.key, (current) => ({
                          ...current,
                          sets: current.sets.map((row, index) =>
                            index === setIndex
                              ? { ...row, weight: event.target.value }
                              : row,
                          ),
                        }))
                      }
                      className="w-28"
                    />
                  </div>
                  {block.sets.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove ${setName}`}
                      onClick={() =>
                        changeBlock(block.key, (current) => ({
                          ...current,
                          sets: current.sets.filter(
                            (_row, index) => index !== setIndex,
                          ),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}

            <div>
              <Button
                type="button"
                variant="outline"
                disabled={block.sets.length >= MAX_PAST_SETS}
                aria-label={`Add set to ${name}`}
                onClick={() =>
                  changeBlock(block.key, (current) => ({
                    ...current,
                    sets: [...current.sets, emptySet()],
                  }))
                }
              >
                Add set
              </Button>
            </div>
          </fieldset>
        );
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          disabled={blocks.length >= MAX_PAST_EXERCISES}
          onClick={addBlock}
        >
          Add exercise
        </Button>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="past-note">Note (optional)</Label>
        <Input
          id="past-note"
          type="text"
          maxLength={MAX_PAST_NOTE_LENGTH}
          placeholder="Felt strong, short on time"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save workout"}
        </Button>
      </div>
      {/* Two regions, both in the page from the start, so each is announced when filled. */}
      <p role="status" className="m-0 text-sm">
        {state.status === "saved" && (
          <>
            {savedMessage(state)}{" "}
            <Link className="underline" href="/history">
              See it in History
            </Link>
          </>
        )}
      </p>
      <p role="alert" className="m-0 text-sm">
        {state.status === "error" && state.message}
      </p>
    </form>
  );
}
