"use client";

import { useMemo, useState } from "react";
import Body, {
  type ExtendedBodyPart,
  type Slug,
} from "react-muscle-highlighter";
import ExerciseCoachChat from "@/components/ExerciseCoachChat";
import { NEUTRAL, WORKED } from "@/components/progress/MuscleMap";
import {
  findExercisesForMuscle,
  type BodyMapExercise,
} from "@/lib/body-map/muscles";
import { MUSCLE_SLUGS } from "@/lib/progress/muscleSlugs";

type BodySide = "front" | "back";

type Hotspot = {
  id: string;
  label: string;
  sides: BodySide[];
};

type BodyMapProps = {
  exercises: BodyMapExercise[];
};

// The muscles a user can pick, and which view of the body shows each one. The
// body itself is drawn by react-muscle-highlighter, the same diagram as the
// progress page, so every muscle sits exactly on the body. MUSCLE_SLUGS gives
// the diagram region for each muscle.
const hotspots: Hotspot[] = [
  { id: "shoulders", label: "Shoulders", sides: ["front", "back"] },
  { id: "chest", label: "Chest", sides: ["front"] },
  { id: "biceps", label: "Biceps", sides: ["front"] },
  { id: "triceps", label: "Triceps", sides: ["back"] },
  { id: "forearms", label: "Forearms", sides: ["front", "back"] },
  { id: "abdominals", label: "Abdominals", sides: ["front"] },
  { id: "middle back", label: "Middle back", sides: ["back"] },
  { id: "lats", label: "Lats", sides: ["back"] },
  { id: "lower back", label: "Lower back", sides: ["back"] },
  { id: "quadriceps", label: "Quadriceps", sides: ["front"] },
  { id: "glutes", label: "Glutes", sides: ["back"] },
  { id: "hamstrings", label: "Hamstrings", sides: ["back"] },
  { id: "calves", label: "Calves", sides: ["front", "back"] },
];

// The selected muscle, matching the selected button below the body.
const SELECTED = "#e9734d";

// Every region the diagram draws. Its artwork gives each region a dark colour
// of its own, so each one is coloured explicitly (as in MuscleMap.tsx).
const ALL_SLUGS: Slug[] = [
  "abs",
  "adductors",
  "ankles",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "feet",
  "forearm",
  "gluteal",
  "hair",
  "hamstring",
  "hands",
  "head",
  "knees",
  "lower-back",
  "neck",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
  "upper-back",
];

export default function BodyMap({ exercises }: BodyMapProps) {
  const [side, setSide] = useState<BodySide>("front");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  const selectedHotspot = hotspots.find((item) => item.id === selectedMuscle);
  const visibleHotspots = hotspots.filter((item) => item.sides.includes(side));
  const matchingExercises = useMemo(
    () =>
      selectedMuscle ? findExercisesForMuscle(selectedMuscle, exercises) : [],
    [exercises, selectedMuscle],
  );
  const selectedExercise = matchingExercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );

  // Muscles that can be picked on this side are green, the selected one is
  // orange, and the rest of the body stays neutral.
  const selectedSlug = selectedMuscle ? MUSCLE_SLUGS[selectedMuscle] : null;
  const pickable = new Set(
    visibleHotspots.map((item) => MUSCLE_SLUGS[item.id]),
  );
  const data: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
    slug,
    color:
      slug === selectedSlug ? SELECTED : pickable.has(slug) ? WORKED : NEUTRAL,
  }));

  function selectMuscle(id: string) {
    setSelectedMuscle(id);
    setSelectedExerciseId(null);
  }

  // A tap on the body picks the first muscle drawn in that region (the upper
  // back is shared by middle back and lats; both also have their own button).
  function pressRegion(part: ExtendedBodyPart) {
    const muscle = visibleHotspots.find(
      (item) => MUSCLE_SLUGS[item.id] === part.slug,
    );
    if (muscle) selectMuscle(muscle.id);
  }

  return (
    <section
      aria-labelledby="body-map-title"
      className="mt-10 border-t border-foreground/15 pt-7"
    >
      <div className="mb-5 max-w-xl">
        <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/55 uppercase">
          Explore by muscle
        </p>
        <h2 className="mt-2 mb-0 text-xl font-semibold" id="body-map-title">
          Where do you want to focus?
        </h2>
        <p className="mt-2 mb-0 text-sm leading-6 text-foreground/65">
          Select a muscle to see related movements and their saved instructions.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)]">
        <div className="border border-foreground/15 bg-white p-4">
          <div
            aria-label="Body view"
            className="grid grid-cols-2 border border-foreground/15"
            role="group"
          >
            {(["front", "back"] as const).map((view) => (
              <button
                aria-pressed={side === view}
                className={`min-h-10 text-xs font-semibold capitalize ${side === view ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/5"}`}
                key={view}
                onClick={() => {
                  setSide(view);
                  setSelectedMuscle(null);
                  setSelectedExerciseId(null);
                }}
                type="button"
              >
                {view}
              </button>
            ))}
          </div>

          {/* Mouse and touch can pick a muscle on the body; the buttons below
              offer the same choices for keyboards and screen readers. */}
          <div
            aria-hidden="true"
            className="mx-auto mt-3 max-w-[230px] [&_svg]:h-auto [&_svg]:w-full"
          >
            <Body
              border="none"
              data={data}
              defaultFill={NEUTRAL}
              onBodyPartPress={pressRegion}
              side={side}
            />
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {visibleHotspots.map((hotspot) => (
              <button
                aria-pressed={selectedMuscle === hotspot.id}
                className={`min-h-8 border px-2.5 text-[11px] transition-colors ${selectedMuscle === hotspot.id ? "border-[#a84025] bg-[#e9734d] text-white" : "border-foreground/15 text-foreground/70 hover:bg-foreground/5"}`}
                key={hotspot.id}
                onClick={() => selectMuscle(hotspot.id)}
                type="button"
              >
                {hotspot.label}
              </button>
            ))}
          </div>
        </div>

        <aside
          aria-labelledby="coach-panel-title"
          aria-live="polite"
          className="min-h-72 border border-foreground/15 bg-white p-5"
          id="coach-panel"
        >
          <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-[#245c43] uppercase">
            Coach panel
          </p>
          {selectedHotspot ? (
            <>
              <h3
                className="mt-2 mb-0 text-lg font-semibold"
                id="coach-panel-title"
              >
                {selectedHotspot.label}
              </h3>
              <p className="mt-2 mb-0 text-sm leading-6 text-foreground/65">
                Library exercises that involve this area.
              </p>
              {matchingExercises.length > 0 ? (
                <ul className="mt-4 divide-y divide-foreground/10 border-y border-foreground/10 p-0">
                  {matchingExercises.slice(0, 5).map((exercise) => (
                    <li className="list-none py-3" key={exercise.id}>
                      <button
                        aria-expanded={selectedExerciseId === exercise.id}
                        className="w-full text-left"
                        onClick={() =>
                          setSelectedExerciseId((current) =>
                            current === exercise.id ? null : exercise.id,
                          )
                        }
                        type="button"
                      >
                        <span className="block text-sm font-semibold">
                          {exercise.name}
                        </span>
                        <span className="mt-1 block text-xs text-foreground/55 capitalize">
                          {exercise.primaryMuscles.join(" · ")}
                          {exercise.equipment && ` · ${exercise.equipment}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 border-l-2 border-[#e9734d] px-3 py-2 text-sm text-foreground/65">
                  No matching exercises are available for this area.
                </p>
              )}
              {selectedExercise && (
                <div className="mt-4 border-l-2 border-[#245c43] pl-3">
                  <p className="m-0 text-xs font-semibold">
                    Saved instructions
                  </p>
                  <ol className="mt-2 space-y-2 pl-4 text-xs leading-5 text-foreground/70">
                    {selectedExercise.instructions
                      .slice(0, 4)
                      .map((instruction, index) => (
                        <li key={`${selectedExercise.id}-${index}`}>
                          {instruction}
                        </li>
                      ))}
                  </ol>
                  <ExerciseCoachChat
                    exerciseId={selectedExercise.id}
                    muscle={selectedHotspot.id}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-56 items-center justify-center text-center">
              <p className="max-w-xs text-sm leading-6 text-foreground/60">
                Select a highlighted muscle area or a muscle name to open its
                exercise references here.
              </p>
            </div>
          )}
          <p className="mt-4 mb-0 border-t border-foreground/10 pt-3 text-[10px] leading-4 text-foreground/50">
            Exercise library references. For pain or an injury, stop the
            movement and see a health professional. Ask the coach on the Coach
            page about your own training.
          </p>
        </aside>
      </div>
    </section>
  );
}
