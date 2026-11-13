"use client";

// The body diagram uses React hooks, so it renders on the client. Worked regions are
// filled; everything else stays neutral (#16). The list below the map carries the
// same information as text, so the map never relies on colour alone.
import Body, {
  type ExtendedBodyPart,
  type Slug,
} from "react-muscle-highlighter";

type MuscleMapProps = {
  slugs: Slug[];
  label: string; // e.g. "Muscles worked in November 2026"
};

const WORKED = "#19211d";
const NEUTRAL = "#d6d9d1";

// Every region the diagram draws. Its artwork gives each region a dark colour of its
// own, which overrides defaultFill, so each one is coloured explicitly.
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

export default function MuscleMap({ slugs, label }: MuscleMapProps) {
  const worked = new Set(slugs);
  const data: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
    slug,
    color: worked.has(slug) ? WORKED : NEUTRAL,
  }));
  return (
    <figure aria-label={label} className="m-0" role="group">
      <div className="mx-auto grid max-w-sm grid-cols-2 gap-4 [&_svg]:h-auto [&_svg]:w-full">
        {(["front", "back"] as const).map((side) => (
          <div key={side}>
            <Body border="none" data={data} defaultFill={NEUTRAL} side={side} />
            <p className="mt-1 mb-0 text-center text-[10px] tracking-[0.12em] text-foreground/55 uppercase">
              {side}
            </p>
          </div>
        ))}
      </div>
    </figure>
  );
}
