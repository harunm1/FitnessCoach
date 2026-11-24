"use client";

// A time shown in the viewer's own zone (#141, #144). On the server, and while the browser
// hydrates, it uses the app's zone so the two match; after that it uses the browser's.
import { useSyncExternalStore } from "react";
import { formatLocal, type LocalTimeKind } from "@/lib/format/localTime";
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

// The browser's zone cannot change under the page, so there is nothing to subscribe to.
const subscribe = () => () => undefined;

export default function LocalTime({
  iso,
  kind,
}: {
  iso: string;
  kind: LocalTimeKind;
}) {
  const date = new Date(iso);
  const text = useSyncExternalStore(
    subscribe,
    () => formatLocal(date, kind),
    () => formatLocal(date, kind, DEFAULT_TIME_ZONE),
  );
  return <time dateTime={iso}>{text}</time>;
}
