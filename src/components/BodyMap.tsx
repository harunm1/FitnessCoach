"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import ExerciseCoachChat from "@/components/ExerciseCoachChat";
import {
  findExercisesForMuscle,
  type BodyMapExercise,
} from "@/lib/body-map/muscles";

type BodySide = "front" | "back";

type Hotspot = {
  id: string;
  label: string;
  front?: [number, number, number, number][];
  back?: [number, number, number, number][];
};

type BodyMapProps = {
  exercises: BodyMapExercise[];
};

const hotspots: Hotspot[] = [
  {
    id: "shoulders",
    label: "Shoulders",
    front: [
      [82, 61, 12, 9],
      [138, 61, 12, 9],
    ],
    back: [
      [82, 61, 12, 9],
      [138, 61, 12, 9],
    ],
  },
  { id: "chest", label: "Chest", front: [[110, 83, 26, 13]] },
  {
    id: "biceps",
    label: "Biceps",
    front: [
      [67, 96, 8, 19],
      [153, 96, 8, 19],
    ],
  },
  {
    id: "triceps",
    label: "Triceps",
    back: [
      [67, 96, 8, 19],
      [153, 96, 8, 19],
    ],
  },
  {
    id: "forearms",
    label: "Forearms",
    front: [
      [55, 139, 7, 23],
      [165, 139, 7, 23],
    ],
    back: [
      [55, 139, 7, 23],
      [165, 139, 7, 23],
    ],
  },
  { id: "abdominals", label: "Abdominals", front: [[110, 126, 18, 25]] },
  { id: "middle back", label: "Middle back", back: [[110, 111, 22, 19]] },
  {
    id: "lats",
    label: "Lats",
    back: [
      [87, 120, 11, 22],
      [133, 120, 11, 22],
    ],
  },
  { id: "lower back", label: "Lower back", back: [[110, 151, 15, 12]] },
  {
    id: "quadriceps",
    label: "Quadriceps",
    front: [
      [94, 198, 12, 31],
      [126, 198, 12, 31],
    ],
  },
  {
    id: "glutes",
    label: "Glutes",
    back: [
      [94, 171, 15, 12],
      [126, 171, 15, 12],
    ],
  },
  {
    id: "hamstrings",
    label: "Hamstrings",
    back: [
      [94, 202, 11, 27],
      [126, 202, 11, 27],
    ],
  },
  {
    id: "calves",
    label: "Calves",
    front: [
      [95, 267, 8, 18],
      [125, 267, 8, 18],
    ],
    back: [
      [95, 267, 8, 18],
      [125, 267, 8, 18],
    ],
  },
];

function BodySilhouette({ side }: { side: BodySide }) {
  return (
    <>
      <circle cx="110" cy="29" r="17" fill="#dfe4df" />
      <path d="M99 48h22v12H99z" fill="#dfe4df" />
      <path
        d={
          side === "front"
            ? "M84 57c-10 2-17 10-20 21l-14 40c-2 6 1 11 6 12 4 1 7-2 9-7l10-25 3 33 8 45-7 54-3 45c0 7 4 11 10 11 5 0 8-4 9-10l5-48 5 48c1 6 4 10 9 10 6 0 10-4 10-11l-3-45-7-54 8-45 3-33 10 25c2 5 5 8 9 7 5-1 8-6 6-12l-14-40c-3-11-10-19-20-21-8-5-16-7-26-7s-18 2-26 7z"
            : "M84 57c-10 2-17 10-20 21l-14 40c-2 6 1 11 6 12 4 1 7-2 9-7l10-25 3 33 8 45-7 54-3 45c0 7 4 11 10 11 5 0 8-4 9-10l5-48 5 48c1 6 4 10 9 10 6 0 10-4 10-11l-3-45-7-54 8-45 3-33 10 25c2 5 5 8 9 7 5-1 8-6 6-12l-14-40c-3-11-10-19-20-21-8-5-16-7-26-7s-18 2-26 7z"
        }
        fill="#dfe4df"
      />
    </>
  );
}

export default function BodyMap({ exercises }: BodyMapProps) {
  const [side, setSide] = useState<BodySide>("front");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  const selectedHotspot = hotspots.find((item) => item.id === selectedMuscle);
  const visibleHotspots = hotspots.filter((item) => item[side]);
  const matchingExercises = useMemo(
    () =>
      selectedMuscle ? findExercisesForMuscle(selectedMuscle, exercises) : [],
    [exercises, selectedMuscle],
  );
  const selectedExercise = matchingExercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );

  function selectMuscle(id: string) {
    setSelectedMuscle(id);
    setSelectedExerciseId(null);
  }

  function handleHotspotKeyDown(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectMuscle(id);
    }
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

          <svg
            aria-label={`${side} body muscle map. Select a highlighted area.`}
            className="mx-auto mt-3 block h-auto w-full max-w-[230px]"
            role="group"
            viewBox="0 0 220 310"
          >
            <BodySilhouette side={side} />
            {visibleHotspots.flatMap(
              (hotspot) =>
                hotspot[side]?.map(([x, y, rx, ry], index) => {
                  const selected = selectedMuscle === hotspot.id;
                  return (
                    <g
                      aria-label={`Select ${hotspot.label}`}
                      aria-pressed={selected}
                      className="cursor-pointer outline-none focus-visible:opacity-100"
                      key={`${hotspot.id}-${index}`}
                      onClick={() => selectMuscle(hotspot.id)}
                      onKeyDown={(event) =>
                        handleHotspotKeyDown(event, hotspot.id)
                      }
                      role="button"
                      tabIndex={0}
                    >
                      <ellipse
                        cx={x}
                        cy={y}
                        fill={selected ? "#e9734d" : "#245c43"}
                        fillOpacity={selected ? 0.8 : 0.48}
                        rx={rx}
                        ry={ry}
                        stroke={selected ? "#a84025" : "#174630"}
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                }) ?? [],
            )}
          </svg>

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
            Library references only; this panel does not provide medical advice
            or AI-generated coaching yet.
          </p>
        </aside>
      </div>
    </section>
  );
}
