"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { acknowledge, useAppState, useHydrated } from "@/lib/store";

export default function Gate() {
  const hydrated = useHydrated();
  const { ackAt } = useAppState();
  const [blocked, setBlocked] = useState(false);

  if (!hydrated || ackAt) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center sheet-backdrop p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <div className="card w-full max-w-md p-6 shadow-2xl" style={{ background: "var(--sheet-solid)" }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-on-accent">
            <ShieldCheck size={22} aria-hidden />
          </span>
          <h2 id="gate-title" className="font-display text-xl font-bold">
            Before you start
          </h2>
        </div>

        {blocked ? (
          <p className="text-sm text-muted">
            BonzStakes is for adults only. Please close this page.
          </p>
        ) : (
          <>
            <ul className="mb-5 space-y-2.5 text-sm text-muted">
              <li>
                <strong className="text-foreground">Research tool, not advice.</strong> BonzStakes
                estimates probabilities from numbers you enter. Nothing here is a tip or a
                guarantee.
              </li>
              <li>
                <strong className="text-foreground">Paper stakes only.</strong> No real money is
                handled. It tracks virtual bets so you can test ideas safely.
              </li>
              <li>
                <strong className="text-foreground">Betting carries risk.</strong> Never stake
                money you can&apos;t afford to lose. Bookmakers&apos; prices are hard to beat.
              </li>
              <li>
                <strong className="text-foreground">Private by design.</strong> Your data stays in
                this browser.
              </li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button autoFocus onClick={acknowledge} className="btn-primary flex-1">
                I&apos;m 18 or older, continue
              </button>
              <button onClick={() => setBlocked(true)} className="btn-secondary">
                I&apos;m under 18
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
