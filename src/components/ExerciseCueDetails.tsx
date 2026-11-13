type ExerciseCueDetailsProps = {
  exerciseName: string;
  cues: string[];
  commonMistakes: string[];
};

export default function ExerciseCueDetails({
  exerciseName,
  cues,
  commonMistakes,
}: ExerciseCueDetailsProps) {
  if (cues.length === 0 && commonMistakes.length === 0) return null;

  return (
    <details
      aria-label={`${exerciseName} form guidance`}
      className="mt-3 border-t border-foreground/10 pt-2"
    >
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Form guidance
      </summary>
      {cues.length > 0 && (
        <section aria-label={`${exerciseName} form cues`} className="mt-3">
          <h3 className="mb-1 text-sm font-semibold">Form cues</h3>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm leading-5 text-foreground/90">
            {cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
      )}
      {commonMistakes.length > 0 && (
        <section
          aria-label={`${exerciseName} common mistakes`}
          className="mt-3"
        >
          <h3 className="mb-1 text-sm font-semibold">Common mistakes</h3>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm leading-5 text-foreground/90">
            {commonMistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
