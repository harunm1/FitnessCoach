import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExerciseCueDetails from "./ExerciseCueDetails";

describe("ExerciseCueDetails", () => {
  it("renders cues and common mistakes in a closed disclosure", () => {
    const markup = renderToStaticMarkup(
      <ExerciseCueDetails
        exerciseName="Barbell Squat"
        cues={["Brace before the lift."]}
        commonMistakes={["Letting the knees collapse inward."]}
      />,
    );

    expect(markup).toContain(
      '<details aria-label="Barbell Squat form guidance"',
    );
    expect(markup).not.toContain(" open=");
    expect(markup).toContain("Form cues");
    expect(markup).toContain("Brace before the lift.");
    expect(markup).toContain("Common mistakes");
    expect(markup).toContain("Letting the knees collapse inward.");
  });

  it("renders nothing when an exercise has no guidance", () => {
    expect(
      renderToStaticMarkup(
        <ExerciseCueDetails
          exerciseName="Stretch"
          cues={[]}
          commonMistakes={[]}
        />,
      ),
    ).toBe("");
  });
});
