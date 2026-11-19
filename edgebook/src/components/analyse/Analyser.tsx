"use client";

import { useMemo, useState } from "react";
import { ArrowDown, RotateCcw, Save, Search } from "lucide-react";
import { Segmented } from "@/components/ui";
import { ScoreGrid } from "@/components/charts";
import { toast } from "@/components/Toaster";
import {
  AnalysisSummary,
  BasketballInputs,
  FootballInputs,
  OddsMap,
  SavedAnalysis,
  Sport,
  TennisInputs,
} from "@/lib/types";
import { addBet, saveAnalysis, useAppState } from "@/lib/store";
import { bankrollOf } from "@/lib/stats";
import { fairProbs, parseOdds } from "@/lib/odds";
import { pct, signedPct, uid } from "@/lib/format";
import { DEFAULT_FOOTBALL, OU_LINES, predictFootball } from "@/lib/models/football";
import { DEFAULT_BASKETBALL, predictBasketball } from "@/lib/models/basketball";
import { DEFAULT_TENNIS, predictTennis } from "@/lib/models/tennis";
import FootballForm from "./FootballForm";
import BasketballForm from "./BasketballForm";
import TennisForm from "./TennisForm";
import MarketsPanel, { BetDraft, evaluate } from "./MarketsPanel";
import ModelSummary from "./ModelSummary";
import ResearchCard from "./ResearchCard";
import BetDialog from "./BetDialog";
import { basketballView, footballView, tennisView, View } from "./views";

const NEEDS: Record<Sport, string> = {
  football: "Add at least one recent result for each team to see the model's view.",
  basketball: "Fill in games played, points scored and points allowed for both teams.",
  tennis: "Add rankings for both players, or each player's recent win–loss record.",
};

export default function Analyser({ initial }: { initial?: SavedAnalysis }) {
  const state = useAppState();
  const { balance } = bankrollOf(state);
  const { settings } = state;

  const [sport, setSport] = useState<Sport>(initial?.sport ?? "football");
  const [fb, setFb] = useState<FootballInputs>(
    initial?.sport === "football" ? (initial.inputs as FootballInputs) : DEFAULT_FOOTBALL
  );
  const [bb, setBb] = useState<BasketballInputs>(
    initial?.sport === "basketball" ? (initial.inputs as BasketballInputs) : DEFAULT_BASKETBALL
  );
  const [tn, setTn] = useState<TennisInputs>(
    initial?.sport === "tennis" ? (initial.inputs as TennisInputs) : DEFAULT_TENNIS
  );
  const [oddsBy, setOddsBy] = useState<Record<Sport, OddsMap>>({
    football: initial?.sport === "football" ? initial.odds : {},
    basketball: initial?.sport === "basketball" ? initial.odds : {},
    tennis: initial?.sport === "tennis" ? initial.odds : {},
  });
  const [savedIds, setSavedIds] = useState<Record<Sport, string | null>>({
    football: initial?.sport === "football" ? initial.id : null,
    basketball: initial?.sport === "basketball" ? initial.id : null,
    tennis: initial?.sport === "tennis" ? initial.id : null,
  });
  const [checklist, setChecklist] = useState<string[]>(initial?.checklist ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ouLine, setOuLine] = useState(2.5);
  const [draft, setDraft] = useState<BetDraft | null>(null);

  const fbModel = useMemo(() => predictFootball(fb), [fb]);
  const bbModel = useMemo(() => predictBasketball(bb), [bb]);
  const tnModel = useMemo(() => predictTennis(tn), [tn]);

  const odds = oddsBy[sport];
  const setOdd = (k: string, v: string) =>
    setOddsBy((o) => ({ ...o, [sport]: { ...o[sport], [k]: v } }));

  const view: View | null = useMemo(() => {
    if (sport === "football" && fbModel) {
      const ctrl = (
        <select
          aria-label="Goals line"
          className="input min-h-9 w-auto py-1 pr-8 text-[13px]"
          value={ouLine}
          onChange={(e) => setOuLine(Number(e.target.value))}
        >
          {OU_LINES.map((l) => (
            <option key={l} value={l}>
              Line {l}
            </option>
          ))}
        </select>
      );
      return footballView(fb, fbModel, ouLine, ctrl);
    }
    if (sport === "basketball" && bbModel) return basketballView(bb, bbModel);
    if (sport === "tennis" && tnModel) return tennisView(tn, tnModel);
    return null;
  }, [sport, fb, fbModel, bb, bbModel, tn, tnModel, ouLine]);

  const evals = useMemo(() => (view ? evaluate(view.groups, odds) : []), [view, odds]);

  const mainGroup = view?.groups.find((g) => g.id === view.main.groupId);
  const mainFair = mainGroup
    ? fairProbs(mainGroup.outcomes.map((o) => parseOdds(odds[o.key])))
    : null;

  const takeaways = useMemo(() => {
    if (!view) return [];
    const t = [...view.insights];
    if (evals.length) {
      const best = evals.reduce((a, b) => (b.ev > a.ev ? b : a));
      t.push(
        best.ev >= settings.evThreshold
          ? `Best price against the model: ${best.label} at ${best.odds.toFixed(2)} (EV ${signedPct(best.ev)}). Check the range before trusting it.`
          : `Nothing clears your ${pct(settings.evThreshold)} minimum edge (closest: ${best.label} at ${best.odds.toFixed(2)}, EV ${signedPct(best.ev)}). Passing is a perfectly good result.`
      );
      const withFair = evals.filter((e) => e.fair !== undefined);
      if (withFair.length) {
        const gap = withFair.reduce((a, b) =>
          Math.abs(b.prob - (b.fair as number)) > Math.abs(a.prob - (a.fair as number)) ? b : a
        );
        const d = gap.prob - (gap.fair as number);
        if (Math.abs(d) >= 0.04)
          t.push(
            `Biggest gap to the market: ${gap.label}, model ${pct(gap.prob)} vs market ${pct(gap.fair as number)}. Big gaps are more often missing information (injuries, rotation) than free money.`
          );
      }
    }
    return t;
  }, [view, evals, settings.evThreshold]);

  const inputs = sport === "football" ? fb : sport === "basketball" ? bb : tn;

  const buildSummary = (v: View): AnalysisSummary => {
    const best = evals.length ? evals.reduce((a, b) => (b.ev > a.ev ? b : a)) : null;
    const labels = v.main.labels;
    const p = v.main.probs;
    const headline = [
      `${labels.home} ${pct(p.home)}`,
      p.draw !== undefined ? `Draw ${pct(p.draw)}` : null,
      `${labels.away} ${pct(p.away)}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      probs: { ...p },
      marketFair: mainFair
        ? {
            home: mainFair.fair[0],
            ...(mainFair.fair.length === 3 ? { draw: mainFair.fair[1] } : {}),
            away: mainFair.fair[mainFair.fair.length - 1],
          }
        : undefined,
      quality: v.quality,
      headline,
      bestEdge: best && best.ev > 0 ? { label: best.label, ev: best.ev, odds: best.odds } : undefined,
    };
  };

  const save = (): string | null => {
    if (!view) return null;
    const id = savedIds[sport] ?? uid();
    const now = new Date().toISOString();
    const existing = state.analyses.find((a) => a.id === id);
    saveAnalysis({
      id,
      sport,
      title: view.title,
      league: view.league.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      inputs,
      odds,
      checklist,
      notes,
      summary: buildSummary(view),
      result: existing?.result,
    });
    setSavedIds((s) => ({ ...s, [sport]: id }));
    return id;
  };

  const reset = () => {
    if (!window.confirm("Clear everything for this match and start over?")) return;
    if (sport === "football") setFb(DEFAULT_FOOTBALL);
    if (sport === "basketball") setBb(DEFAULT_BASKETBALL);
    if (sport === "tennis") setTn(DEFAULT_TENNIS);
    setOddsBy((o) => ({ ...o, [sport]: {} }));
    setSavedIds((s) => ({ ...s, [sport]: null }));
    setChecklist([]);
    setNotes("");
  };

  const names =
    sport === "football"
      ? [fb.home, fb.away]
      : sport === "basketball"
      ? [bb.home, bb.away]
      : [tn.a, tn.b];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="h-page">Analyse a match</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Enter recent results, compare the model with bookmaker odds, and track paper bets. Pick a
            sport to begin.
          </p>
        </div>
        <Segmented<Sport>
          label="Sport"
          value={sport}
          onChange={setSport}
          options={[
            { value: "football", label: "Football" },
            { value: "basketball", label: "Basketball" },
            { value: "tennis", label: "Tennis" },
          ]}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          {view && (
            <a href="#results" className="btn-secondary mb-4 w-full lg:hidden">
              <ArrowDown size={16} aria-hidden /> Results are ready
            </a>
          )}
          {sport === "football" && <FootballForm value={fb} onChange={setFb} />}
          {sport === "basketball" && <BasketballForm value={bb} onChange={setBb} />}
          {sport === "tennis" && <TennisForm value={tn} onChange={setTn} />}
        </div>

        <div id="results" className="space-y-4 scroll-mt-20">
          {!view ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <Search size={28} className="mb-3 text-muted" aria-hidden />
              <h2 className="font-mono text-base font-semibold">Your analysis will appear here</h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted">{NEEDS[sport]}</p>
              <ol className="mt-6 w-full max-w-sm space-y-2 text-left text-sm text-muted">
                <li>
                  <span className="num mr-2 text-accent">1</span>Enter recent results
                </li>
                <li>
                  <span className="num mr-2 text-accent">2</span>Read the model&apos;s probabilities
                </li>
                <li>
                  <span className="num mr-2 text-accent">3</span>Add bookmaker odds to find where they disagree
                </li>
              </ol>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary"
                  onClick={() => {
                    save();
                    toast(savedIds[sport] ? "Analysis updated in your Journal" : "Saved to your Journal");
                  }}
                >
                  <Save size={16} aria-hidden /> {savedIds[sport] ? "Update saved analysis" : "Save to Journal"}
                </button>
                <button className="btn-ghost" onClick={reset}>
                  <RotateCcw size={16} aria-hidden /> Start over
                </button>
              </div>

              <ModelSummary
                view={view}
                takeaways={takeaways}
                extra={
                  sport === "football" && fbModel ? (
                    <dl className="num mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-sm" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <dt className="text-xs text-muted">Expected goals</dt>
                        <dd className="font-semibold">
                          {fbModel.lambdaHome.toFixed(2)} – {fbModel.lambdaAway.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Attack index</dt>
                        <dd className="font-semibold">
                          {fbModel.homeStrength.attack.toFixed(2)} / {fbModel.awayStrength.attack.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Defence index</dt>
                        <dd className="font-semibold">
                          {fbModel.homeStrength.defence.toFixed(2)} / {fbModel.awayStrength.defence.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                  ) : sport === "basketball" && bbModel ? (
                    <dl className="num mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-sm" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <dt className="text-xs text-muted">Projected score</dt>
                        <dd className="font-semibold">
                          {bbModel.expHome.toFixed(0)} – {bbModel.expAway.toFixed(0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Margin</dt>
                        <dd className="font-semibold">
                          {bbModel.margin > 0 ? "+" : ""}
                          {bbModel.margin.toFixed(1)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Total</dt>
                        <dd className="font-semibold">{bbModel.total.toFixed(0)}</dd>
                      </div>
                    </dl>
                  ) : undefined
                }
              />

              <MarketsPanel
                groups={view.groups}
                odds={odds}
                setOdd={setOdd}
                quality={view.quality}
                settings={settings}
                bankroll={balance}
                onBet={setDraft}
              />

              {sport === "football" && fbModel && (
                <div className="card-pad">
                  <h3 className="mb-3 font-mono text-sm font-semibold">Scoreline probabilities</h3>
                  <ScoreGrid
                    matrix={fbModel.matrix}
                    homeName={fb.home || "Home"}
                    awayName={fb.away || "Away"}
                  />
                  <p className="mt-3 text-[13px] text-muted">
                    Most likely:{" "}
                    {fbModel.topScores
                      .slice(0, 4)
                      .map((s) => `${s.h}–${s.a} (${(s.p * 100).toFixed(0)}%)`)
                      .join(", ")}
                  </p>
                </div>
              )}

              <ResearchCard
                sport={sport}
                a={names[0]}
                b={names[1]}
                checklist={checklist}
                onChecklist={setChecklist}
                notes={notes}
                onNotes={setNotes}
              />
            </>
          )}
        </div>
      </div>

      <BetDialog
        draft={draft}
        currency={settings.currency}
        balance={balance}
        matchLabel={view?.title ?? ""}
        onClose={() => setDraft(null)}
        onConfirm={({ odds: o, stake, note }) => {
          if (!draft || !view) return;
          const id = save();
          addBet({
            analysisId: id ?? undefined,
            sport,
            matchLabel: view.title,
            market: draft.groupTitle,
            selection: draft.selection,
            odds: o,
            stake,
            modelProb: draft.prob,
            fairProb: draft.fair,
            note: note.trim() || undefined,
          });
          setDraft(null);
          toast("Paper bet placed. Find it under Bets.");
        }}
      />
    </div>
  );
}
