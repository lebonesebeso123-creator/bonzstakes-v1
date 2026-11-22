"use client";

import { useEffect, useRef } from "react";
import { applyResults, getState, settleTracked } from "@/lib/store";
import { resultFor } from "@/lib/research/provider";
import { ResultOrVoid } from "@/lib/research/data";
import { settleOutcome } from "@/lib/research/engine";

const FINISH_MS = 115 * 60_000;

/** Fetches results for anything that should have finished, for both slips and the daily scorecard. */
export async function settleDue(forceDemo = false): Promise<number> {
  const s = getState();
  const now = Date.now();
  const due = new Map<string, { home: string; away: string; kickoff: string }>();
  for (const b of s.bets)
    if (b.status === "open")
      for (const l of b.legs ?? [])
        if (l.status === "open" && (forceDemo || new Date(l.kickoff).getTime() + FINISH_MS < now))
          due.set(l.fixtureId, { home: l.home, away: l.away, kickoff: l.kickoff });
  for (const t of s.tracked ?? [])
    if (t.status === "open" && (forceDemo || new Date(t.kickoff).getTime() + FINISH_MS < now))
      due.set(t.fixtureId, { home: t.home, away: t.away, kickoff: t.kickoff });
  if (!due.size) return 0;
  const results: Record<string, ResultOrVoid> = {};
  for (const [id, hint] of due) {
    try {
      const r = await resultFor(id, s.settings.dataUrl, forceDemo && !id.startsWith("fd"), hint);
      if (r) results[id] = r;
    } catch {
      /* try again next time */
    }
  }
  if (!Object.keys(results).length) return 0;
  applyResults(results, settleOutcome);
  settleTracked(results, settleOutcome);
  return Object.keys(results).length;
}

export default function ResultsAgent() {
  const busy = useRef(false);
  useEffect(() => {
    const go = async () => {
      if (busy.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      busy.current = true;
      try {
        await settleDue();
      } finally {
        busy.current = false;
      }
    };
    void go();
    const id = window.setInterval(go, 10 * 60_000);
    const onShow = () => document.visibilityState === "visible" && void go();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return null;
}
