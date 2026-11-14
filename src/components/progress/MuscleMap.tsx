"use client";

// The body diagram uses React hooks, so it renders on the client. Worked regions are
// filled; everything else stays neutral (#16). Hovering or tapping a muscle shows
// how often it was used. The list below the map carries the same information as
// text, so nothing depends on colour or hover alone.
import { useState, type PointerEvent } from "react";
import Body, {
  type ExtendedBodyPart,
  type Slug,
} from "react-muscle-highlighter";

type MuscleMapProps = {
  slugs: Slug[];
  label: string; // e.g. "Muscles worked in November 2026"
  // The hover label for each muscle region (regionLabels in muscleSlugs.ts).
  labels: Partial<Record<Slug, string>>;
};

// The diagram takes colours, not CSS, so these are fixed; the progress theme
// swaps them for dark mode.
export const WORKED = "#2f6345";
export const NEUTRAL = "#d6d9d1";
const TIP_HALF_WIDTH = 112; // half of the label's max width (14rem)

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

type Tip = { text: string; x: number; y: number };

export default function MuscleMap({ slugs, label, labels }: MuscleMapProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const worked = new Set(slugs);
  const data: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
    slug,
    color: worked.has(slug) ? WORKED : NEUTRAL,
  }));

  // Each muscle is drawn as a path whose id is its region, e.g. "chest".
  function show(event: PointerEvent<HTMLDivElement>) {
    const region = (event.target as Element).closest?.("path[id]");
    const text = region ? labels[region.id as Slug] : undefined;
    if (!text) {
      setTip(null);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    setTip({
      text,
      // Kept inside the map, so the label never runs off a phone screen.
      x: Math.min(
        Math.max(x, TIP_HALF_WIDTH),
        Math.max(box.width - TIP_HALF_WIDTH, TIP_HALF_WIDTH),
      ),
      y: event.clientY - box.top,
    });
  }

  return (
    <figure aria-label={label} className="m-0" role="group">
      <div
        className="relative mx-auto grid max-w-sm grid-cols-2 gap-4 [&_svg]:h-auto [&_svg]:w-full"
        onPointerDown={show}
        onPointerMove={show}
        // A finger lifting also "leaves", so only a mouse hides the label here.
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setTip(null);
        }}
      >
        {(["front", "back"] as const).map((side) => (
          <div key={side}>
            <Body border="none" data={data} defaultFill={NEUTRAL} side={side} />
            <p className="mt-1 mb-0 text-center text-[10px] tracking-[0.12em] text-foreground/55 uppercase">
              {side}
            </p>
          </div>
        ))}
        {tip && (
          <p
            className="pointer-events-none absolute z-10 m-0 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded bg-foreground px-2 py-1 text-xs text-background shadow"
            role="tooltip"
            style={{ left: tip.x, top: tip.y - 10 }}
          >
            {tip.text}
          </p>
        )}
      </div>
    </figure>
  );
}
