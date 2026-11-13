// The /coach error state: no raw error text, and "Try again" calls retry().
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import CoachError from "./error";

type ButtonProps = { onClick?: () => void; children?: ReactNode };

function findButton(node: ReactNode): ReactElement<ButtonProps> | null {
  if (!isValidElement<ButtonProps>(node)) return null;
  if (node.props.onClick) return node;
  for (const child of ([] as ReactNode[]).concat(node.props.children ?? [])) {
    const found = findButton(child);
    if (found) return found;
  }
  return null;
}

describe("coach error.tsx", () => {
  it("never shows the raw error message", () => {
    const html = renderToStaticMarkup(
      <CoachError
        error={new Error("relation Message does not exist")}
        retry={() => {}}
      />,
    );

    expect(html).toContain('data-testid="coach-error"');
    expect(html).not.toContain("relation Message does not exist");
  });

  it("calls retry once when Try again is pressed", () => {
    const retry = vi.fn();
    findButton(CoachError({ error: new Error("x"), retry }))?.props.onClick?.();

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
