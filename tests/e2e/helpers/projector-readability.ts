import type { Page } from "@playwright/test";

export type SmallVisibleText = { text: string; fontSize: number };

export async function visibleTextBelowProjectorSize(
  page: Page,
): Promise<SmallVisibleText[]> {
  return page.locator("body").evaluate((body) => {
    const smallText: SmallVisibleText[] = [];

    for (const element of body.querySelectorAll<HTMLElement>("*")) {
      if (
        element.closest(
          '[data-projector-decorative="true"], .sr-only, [aria-hidden="true"]',
        )
      ) {
        continue;
      }

      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!text || element.getClientRects().length === 0) continue;

      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const fontSize = Number.parseFloat(style.fontSize);
      if (fontSize < 14) smallText.push({ text, fontSize });
    }

    return smallText;
  });
}
