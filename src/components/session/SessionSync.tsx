"use client";

// Starts the offline set queue for the signed-in user (D31), replays it on page load and
// whenever the browser comes back online, refreshes the page after a sync, and shows the
// status pill.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  onSessionSetsSynced,
  sessionSetQueue,
  useSessionSetQueue,
} from "@/lib/offline/sessionSetQueue";
import SyncStatusPill from "./SyncStatusPill";

export default function SessionSync({ userId }: { userId: string }) {
  const router = useRouter();
  const queue = useSessionSetQueue();

  useEffect(() => {
    void sessionSetQueue.start(userId);
  }, [userId]);

  useEffect(() => {
    const report = () => void sessionSetQueue.setOnline(navigator.onLine);
    window.addEventListener("online", report);
    window.addEventListener("offline", report);
    return () => {
      window.removeEventListener("online", report);
      window.removeEventListener("offline", report);
    };
  }, []);

  useEffect(() => onSessionSetsSynced(() => router.refresh()), [router]);

  const failure = queue.failure;

  return (
    <SyncStatusPill
      failure={failure}
      justSynced={queue.justSynced}
      online={queue.online}
      pending={queue.items.length}
      syncing={queue.syncing}
      onDiscard={() => {
        if (failure?.kind === "rejected") {
          void sessionSetQueue.discard(failure.clientId);
        }
      }}
      onRetry={() => void sessionSetQueue.sync()}
    />
  );
}
