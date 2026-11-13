// Checks the root error state renders with its test id and that "Try again" calls retry().
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RouteError from "./error";

type ButtonProps = { onClick?: () => void; children?: ReactNode };

// Finds the element labelled "Try again" by its props, so a later shadcn <Button> still matches.
// RouteError is called as a plain function, so it must stay free of hooks until a DOM test library lands.
function findTryAgain(node: ReactNode): ReactElement<ButtonProps> | null {
  if (!isValidElement<ButtonProps>(node)) return null;
  const children = ([] as ReactNode[]).concat(node.props.children ?? []);
  if (node.props.onClick && children.includes("Try again")) return node;
  for (const child of children) {
    const found = findTryAgain(child);
    if (found) return found;
  }
  return null;
}

describe("root error.tsx", () => {
  it("renders the error state with its test id and no raw error message", () => {
    const html = renderToStaticMarkup(
      <RouteError
        error={new Error("relation Plan does not exist")}
        retry={() => {}}
      />,
    );
    expect(html).toContain('data-testid="route-error"');
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).not.toContain("relation Plan does not exist");
  });

  it("announces the message to screen readers as an alert", () => {
    const html = renderToStaticMarkup(
      <RouteError error={new Error("x")} retry={() => {}} />,
    );
    expect(html).toMatch(
      /<p[^>]*role="alert"[^>]*>This page could not load\. Try again in a moment\.<\/p>/,
    );
  });

  it("calls retry once when Try again is pressed", () => {
    const retry = vi.fn();
    const button = findTryAgain(RouteError({ error: new Error("x"), retry }));
    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
