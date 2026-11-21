"use client";

import { useEffect, useRef } from "react";
import { getState, useAppState } from "@/lib/store";
import { syncNow } from "@/lib/sync";

/** Syncs quietly on open, 15s after changes, and when the app goes to the background. */
export default function SyncAgent() {
  const state = useAppState();
  const enabled = !!state.sync?.token;
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const go = async () => {
      if (running.current || !navigator.onLine) return;
      running.current = true;
      try {
        await syncNow();
      } catch {
        /* quiet: Account shows errors when syncing by hand */
      }
      running.current = false;
    };
    void go();
    const onHide = () => {
      const s = getState();
      if (document.visibilityState === "hidden" && (s.updatedAt ?? "") > (s.sync?.lastSync ?? "")) void go();
    };
    document.addEventListener("visibilitychange", onHide);
    (window as unknown as { __bzSync?: () => void }).__bzSync = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(go, 15_000);
    };
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if ((state.updatedAt ?? "") > (state.sync?.lastSync ?? "")) (window as unknown as { __bzSync?: () => void }).__bzSync?.();
  }, [enabled, state.updatedAt, state.sync?.lastSync]);

  return null;
}
