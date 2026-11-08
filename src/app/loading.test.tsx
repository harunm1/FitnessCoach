// Checks the root loading fallback shows while a page's data loads and is replaced once it arrives.
import { Writable } from "node:stream";
import { Suspense, use, type ReactNode } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

function PlanName({ plan }: { plan: Promise<string> }) {
  return <h1>{use(plan)}</h1>;
}

// Streams `node` the way Next.js does; `shell` settles on the first chunk sent, `html()` is all sent so far.
function stream(node: ReactNode) {
  let received = "";
  let shellReady: () => void = () => {};
  let finished: () => void = () => {};
  const shell = new Promise<void>((resolve) => (shellReady = resolve));
  const done = new Promise<void>((resolve) => (finished = resolve));
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      received += String(chunk);
      shellReady();
      callback();
    },
    final(callback) {
      finished();
      callback();
    },
  });
  const render = renderToPipeableStream(node, {
    onShellReady() {
      render.pipe(sink);
    },
  });
  return { shell, done, html: () => received };
}

describe("root loading.tsx", () => {
  it("renders the plain-text fallback as a status message", () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain("Loading your plan...");
    expect(html).toContain('role="status"');
  });

  it("shows while data loads, then the page replaces it", async () => {
    let resolvePlan: (name: string) => void = () => {};
    const plan = new Promise<string>((resolve) => (resolvePlan = resolve));
    // A full document, as the root layout renders: React holds back a fallback that is the whole output.
    const page = stream(
      <html lang="en">
        <body>
          <Suspense fallback={<Loading />}>
            <PlanName plan={plan} />
          </Suspense>
        </body>
      </html>,
    );

    await page.shell;
    expect(page.html()).toContain("Loading your plan...");
    expect(page.html()).not.toContain("Upper body A");

    resolvePlan("Upper body A");
    await page.done;
    expect(page.html()).toContain("Upper body A");
  });
});
