"use client";

import { useMemo, useState } from "react";
import { Brain, Scale, Sparkles } from "lucide-react";
import { AnalysedMatch, Pick, buildSlip, modelPicks, valuePicks } from "@/lib/research/engine";
import { replaceSlip } from "@/lib/store";
import { loadLiveFile } from "@/lib/research/file-provider";
import { LiveFile } from "@/lib/fd/live-file";
import { useEffect } from "react";
import { toast } from "@/components/Toaster";
import { PickRow, kickoffLabel, whyFor } from "./MatchCard";
import { legFrom } from "./PickButton";

function PickList({
  picks,
  byId,
  slip,
  empty,
}: {
  picks: Pick[];
  byId: Map<string, AnalysedMatch>;
  slip: Map<string, string>;
  empty: string;
}) {
  if (!picks.length) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
      {picks.map((p) => {
        const m = byId.get(p.fixtureId)!;
        return (
          <li key={p.fixtureId + p.key} className="py-1">
            <div className="num truncate pt-1.5 text-[12px] text-muted">
              {m.fixture.home} v {m.fixture.away} · {kickoffLabel(m.fixture.kickoff).day}
            </div>
            <ul>
              <PickRow pick={p} m={m} inSlip={slip.get(p.fixtureId) === p.key} why={whyFor(p, m)[0]} />
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function addAll(picks: Pick[], byId: Map<string, AnalysedMatch>, what: string) {
  replaceSlip(picks.map((p) => legFrom(p, byId.get(p.fixtureId)!.fixture)));
  toast(`${picks.length} ${what} on your slip`);
}

/** What the backtest says about these numbers, so you know how far to trust them. */
function TrackRecord() {
  const [bt, setBt] = useState<LiveFile["backtest"] | null>(null);
  useEffect(() => {
    let live = true;
    loadLiveFile().then((f) => live && f && setBt(f.backtest));
    return () => {
      live = false;
    };
  }, []);
  if (!bt) return null;
  const p = (x: number) => `${(x * 100).toFixed(1)}%`;
  const s = (x: number | null) => (x === null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`);
  return (
    <section className="card-pad lg:col-span-2">
      <h2 className="font-display text-[16px] font-bold">Track record</h2>
      <p className="hint !mt-0.5">
        Tested on {bt.testedOn.toLocaleString()} real matches ({bt.seasons}), none of which were used to tune it.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="stat-tile">
          <div className="text-[11px] text-muted">Most likely picks landed</div>
          <div className="num text-lg font-bold">{p(bt.topPicks.winRatio)}</div>
          <div className="num text-[11px] text-muted">expected {p(bt.topPicks.expected)} over {bt.topPicks.picks.toLocaleString()} picks</div>
        </div>
        <div className="stat-tile">
          <div className="text-[11px] text-muted">Value picks at the best price</div>
          <div className={`num text-lg font-bold ${(bt.valueBest.roi ?? 0) >= 0 ? "text-mint" : "text-danger"}`}>{s(bt.valueBest.roi)} return</div>
          <div className="num text-[11px] text-muted">{bt.valueBest.picks} picks, {s(bt.valueBest.clv)} vs closing line</div>
        </div>
        <div className="stat-tile">
          <div className="text-[11px] text-muted">Most likely picks at one bookmaker</div>
          <div className={`num text-lg font-bold ${(bt.topPicks.roi ?? 0) >= 0 ? "text-mint" : "text-danger"}`}>{s(bt.topPicks.roi)} return</div>
          <div className="num text-[11px] text-muted">the bookmaker&apos;s margin wins here</div>
        </div>
      </div>
      <p className="hint mt-2">
        Accurate chances don&apos;t beat the margin on their own. Profit came from taking the best price, so compare
        bookmakers and type your price on the slip.
      </p>
    </section>
  );
}

export function Suggestions({ matches, slip }: { matches: AnalysedMatch[]; slip: Map<string, string> }) {
  const byId = useMemo(() => new Map(matches.map((m) => [m.fixture.id, m])), [matches]);
  const model = useMemo(() => modelPicks(matches), [matches]);
  const value = useMemo(() => valuePicks(matches), [matches]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TrackRecord />
      <section className="card-pad min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[16px] font-bold">
              <Brain size={16} aria-hidden className="text-accent" /> Most likely
            </h2>
            <p className="hint">The highest-probability picks across every match you researched.</p>
          </div>
          {model.length > 0 && (
            <button className="btn-secondary btn-sm shrink-0" onClick={() => addAll(model, byId, "most likely picks")}>
              Add all
            </button>
          )}
        </div>
        <PickList picks={model} byId={byId} slip={slip} empty="No picks clear the bar. Try more markets or a longer time frame." />
      </section>

      <section className="card-pad min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[16px] font-bold">
              <Scale size={16} aria-hidden className="text-accent" /> Value vs the odds
            </h2>
            <p className="hint">Where the estimate beats the bookmaker&apos;s price. Less likely to win, better long-run price.</p>
          </div>
          {value.length > 0 && (
            <button className="btn-secondary btn-sm shrink-0" onClick={() => addAll(value, byId, "value picks")}>
              Add all
            </button>
          )}
        </div>
        <PickList picks={value} byId={byId} slip={slip} empty="Prices look fair across the board. That's normal; skip rather than force it." />
      </section>
    </div>
  );
}

const TARGETS = [2, 3, 5, 10, 20];

export function SlipBuilder({ matches }: { matches: AnalysedMatch[] }) {
  const [target, setTarget] = useState(5);
  const [custom, setCustom] = useState("");
  const byId = useMemo(() => new Map(matches.map((m) => [m.fixture.id, m])), [matches]);
  const t = custom ? Number(custom.replace(",", ".")) : target;
  const valid = isFinite(t) && t >= 1.2 && t <= 1000;
  const slip = useMemo(() => (valid ? buildSlip(matches, t) : null), [matches, t, valid]);

  return (
    <section className="card-pad min-w-0">
      <h2 className="flex items-center gap-2 font-display text-[16px] font-bold">
        <Sparkles size={16} aria-hidden className="text-accent" /> Build a slip for me
      </h2>
      <p className="hint">Pick the total odds you want. BonzStakes finds the most likely combination that reaches them.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Target odds">
        {TARGETS.map((v) => (
          <button
            key={v}
            className="chip num"
            aria-pressed={!custom && target === v}
            onClick={() => {
              setTarget(v);
              setCustom("");
            }}
          >
            {v}.00
          </button>
        ))}
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <span className="sr-only">Custom target odds</span>
          <input
            className="input num !min-h-9 w-24 text-center text-[14px]"
            inputMode="decimal"
            placeholder="Custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-invalid={custom !== "" && !valid}
          />
        </label>
      </div>

      {slip && slip.legs.length > 0 ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="stat-tile">
              <div className="text-[11px] text-muted">Selections</div>
              <div className="num text-lg font-semibold">{slip.legs.length}</div>
            </div>
            <div className="stat-tile">
              <div className="text-[11px] text-muted">Total odds</div>
              <div className="num text-lg font-semibold">{slip.totalOdds.toFixed(2)}</div>
            </div>
            <div className="stat-tile">
              <div className="text-[11px] text-muted">Chance all win</div>
              <div className="num text-lg font-semibold text-accent">{(slip.chance * 100).toFixed(0)}%</div>
            </div>
          </div>
          <p className="num mt-2 text-center text-[12px] text-muted">
            {slip.legs.map((l) => l.odds.toFixed(2)).join(" × ")} = <span className="font-bold text-foreground">{slip.totalOdds.toFixed(2)}</span>
          </p>
          <p className="hint text-center">
            Expected value {slip.legs.reduce((a, l) => a * l.prob * l.odds, 1) - 1 >= 0 ? "+" : "−"}
            {Math.abs((slip.legs.reduce((a, l) => a * l.prob * l.odds, 1) - 1) * 100).toFixed(0)}%
            {slip.legs.some((l) => !l.priced) && " · some prices estimated"}
          </p>
          {!slip.reached && <p className="mt-2 text-xs text-warn">Not enough strong picks to reach {t.toFixed(2)}. Add markets or widen the time frame.</p>}
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
            {slip.legs.map((p) => {
              const f = byId.get(p.fixtureId)!.fixture;
              return (
                <li key={p.fixtureId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{p.label}</div>
                    <div className="num truncate text-[12px] text-muted">
                      {f.home} v {f.away} · {(p.prob * 100).toFixed(0)}%
                    </div>
                  </div>
                  <span className="num shrink-0 text-[14px] font-semibold">{p.odds.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <button
            className="btn-primary mt-3 w-full"
            onClick={() => {
              replaceSlip(slip.legs.map((p) => legFrom(p, byId.get(p.fixtureId)!.fixture)));
              toast("Slip ready. Set your stake below.");
            }}
          >
            Put on my slip
          </button>
          <p className="hint mt-2">
            Every extra selection multiplies the risk. A {slip.legs.length}-leg slip at these odds loses about{" "}
            {(100 - slip.chance * 100).toFixed(0)}% of the time.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{valid ? "No suitable picks in this search." : "Enter odds between 1.20 and 1000."}</p>
      )}
    </section>
  );
}
