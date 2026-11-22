"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, FlaskConical, RefreshCw, XCircle } from "lucide-react";
import { resetLearning, useAppState } from "@/lib/store";
import { settleDue } from "@/components/ResultsAgent";
import { LEARN_MIN, learnFactor, learningFrom } from "@/lib/research/engine";
import { MARKET_GROUPS, SELECTION_BY_KEY } from "@/lib/research/markets";
import { Leg } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { kickoffLabel } from "./MatchCard";

function LegIcon({ s }: { s: Leg["status"] }) {
  if (s === "won") return <CheckCircle2 size={16} className="text-emerald-400" aria-label="Won" />;
  if (s === "lost") return <XCircle size={16} className="text-danger" aria-label="Lost" />;
  if (s === "void") return <Circle size={16} className="text-muted" aria-label="Void" />;
  return <Clock size={16} className="text-muted" aria-label="Pending" />;
}

/** Each selection on a slip, with the final score once it's in. */
export function LegList({ legs }: { legs: Leg[] }) {
  return (
    <ul className="mt-3 divide-y rounded-xl px-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {legs.map((l) => (
        <li key={l.id} className={`flex items-start gap-2.5 py-2.5 ${l.status === "void" ? "opacity-60" : ""}`}>
          <span className="mt-0.5 shrink-0">
            <LegIcon s={l.status} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium">{l.selection}</div>
            <div className="truncate text-[12px] text-muted">
              {l.home} v {l.away}
            </div>
            <div className="num text-[12px] text-muted">
              {l.status === "void" ? (
                <>Void · stake on this leg counts at 1.00</>
              ) : l.result ? (
                <>
                  FT {l.result.home}–{l.result.away} · HT {l.result.htHome}–{l.result.htAway}
                  {l.result.corners ? <> · {l.result.corners} corners</> : null}
                </>
              ) : (
                <>{kickoffLabel(l.kickoff).day} · {kickoffLabel(l.kickoff).time}</>
              )}
            </div>
          </div>
          <div className="num shrink-0 text-right">
            <div className="text-[14px] font-semibold">{l.odds.toFixed(2)}</div>
            <div className="text-[11px] text-muted">{(l.prob * 100).toFixed(0)}%</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Manual result check (the background agent also does this every 10 minutes). */
export function ResultChecker() {
  const state = useAppState();
  const [busy, setBusy] = useState(false);
  const pending = useMemo(
    () =>
      state.bets
        .filter((b) => b.status === "open" && b.legs)
        .flatMap((b) => b.legs!.filter((l) => l.status === "open")),
    [state.bets]
  );
  const check = async (forceDemo = false) => {
    setBusy(true);
    const n = await settleDue(forceDemo);
    setBusy(false);
    toast(n ? `Settled ${n} ${n === 1 ? "match" : "matches"}` : "No new results yet. Scores usually arrive within 3 hours of full time.");
  };

  if (!pending.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button className="btn-secondary btn-sm" onClick={() => check()} disabled={busy}>
        <RefreshCw size={14} aria-hidden className={busy ? "animate-spin" : ""} /> Check results
      </button>
      {pending.some((l) => !l.fixtureId.startsWith("fd")) && (
        <button className="btn-ghost btn-sm" onClick={() => check(true)} disabled={busy}>
          <FlaskConical size={14} aria-hidden /> Simulate results (demo)
        </button>
      )}
      <span className="text-xs text-muted">
        {pending.length} {pending.length === 1 ? "selection" : "selections"} waiting
      </span>
    </div>
  );
}

/** After-match review: how each market's picks did against what the model expected. */
export function LearningCard() {
  const state = useAppState();
  const rows = useMemo(() => {
    const L = learningFrom(state.bets, state.learningSince, state.tracked);
    return MARKET_GROUPS.map((g) => {
      const keys = Object.keys(L).filter((k) => SELECTION_BY_KEY[k]?.group === g.id);
      const n = keys.reduce((a, k) => a + L[k].n, 0);
      if (!n) return null;
      const wins = keys.reduce((a, k) => a + L[k].wins, 0);
      const expected = keys.reduce((a, k) => a + L[k].expected, 0);
      const factor = keys.reduce((a, k) => a + learnFactor(L, k) * L[k].n, 0) / n;
      return { g, n, hit: wins / n, exp: expected / n, factor };
    }).filter(Boolean) as { g: (typeof MARKET_GROUPS)[number]; n: number; hit: number; exp: number; factor: number }[];
  }, [state.bets, state.learningSince, state.tracked]);

  return (
    <div className="card-pad">
      <h2 className="mb-1 font-display text-[16px] font-bold">What the model learned</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          As your slips and the daily scorecard settle, this compares how often each market landed with how often
          BonzStakes expected, and nudges future estimates.
        </p>
      ) : (
        <>
          <p className="hint mb-3">
            After {LEARN_MIN} settled picks, a market&apos;s future estimates are nudged by up to ±15% toward what actually
            happened. It moves slowly on purpose: a few results are mostly luck.
          </p>
          <div className="overflow-x-auto">
            <table className="num w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 font-medium">Market</th>
                  <th className="py-1.5 pl-2 text-right font-medium">Picks</th>
                  <th className="py-1.5 pl-2 text-right font-medium" title="Expected hit rate">Exp.</th>
                  <th className="py-1.5 pl-2 text-right font-medium" title="Actual hit rate">Hit</th>
                  <th className="py-1.5 pl-2 text-right font-medium" title="Adjustment to future estimates">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.g.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 font-sans">{r.g.short}</td>
                    <td className="py-2 text-right">{r.n}</td>
                    <td className="py-2 text-right">{(r.exp * 100).toFixed(0)}%</td>
                    <td className={`py-2 text-right ${r.hit >= r.exp ? "text-emerald-400" : "text-danger"}`}>{(r.hit * 100).toFixed(0)}%</td>
                    <td className="py-2 text-right">
                      {r.n < LEARN_MIN ? (
                        <span className="text-muted" title={`Adjusts after ${LEARN_MIN} picks`}>{LEARN_MIN - r.n} more</span>
                      ) : Math.abs(r.factor - 1) < 0.005 ? (
                        "Same"
                      ) : (
                        `${r.factor > 1 ? "+" : "−"}${Math.abs((r.factor - 1) * 100).toFixed(0)}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn-ghost btn-sm mt-2"
            onClick={() => window.confirm("Reset what the model has learned? Your bets stay.") && resetLearning()}
          >
            Reset learning
          </button>
        </>
      )}
    </div>
  );
}
