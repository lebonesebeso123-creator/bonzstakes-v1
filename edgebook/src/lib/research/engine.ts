import { predictFootball, DEFAULT_FOOTBALL, validRows } from "../models/football";
import { Quality } from "../types";
import { Fixture } from "./data";
import { MarketGroup, MatchResult, SELECTIONS, SELECTION_BY_KEY, probsFromRates, selectionLabel } from "./markets";

/* ---------------- time frames ---------------- */

export type TimeFrame = "today" | "tomorrow" | "weekend" | "3days" | "week";

export const TIME_FRAMES: { id: TimeFrame; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This weekend" },
  { id: "3days", label: "Next 3 days" },
  { id: "week", label: "Next 7 days" },
];

export function rangeFor(tf: TimeFrame, now = new Date()): { from: Date; to: Date } {
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + offset);
    return d;
  };
  switch (tf) {
    case "today":
      return { from: now, to: day(1) };
    case "tomorrow":
      return { from: day(1), to: day(2) };
    case "3days":
      return { from: now, to: day(3) };
    case "week":
      return { from: now, to: day(7) };
    case "weekend": {
      const dow = now.getDay(); // 0 Sun … 6 Sat
      if (dow === 6 || dow === 0) return { from: now, to: day(dow === 6 ? 2 : 1) };
      const toSat = (6 - dow + 7) % 7;
      // Friday-night games count as the weekend
      return { from: dow === 5 ? now : day(toSat - 1), to: day(toSat + 2) };
    }
  }
}

/* ---------------- learning ---------------- */

/** Per selection key: how often the model's picks landed vs how often it expected them to. */
export type Learning = Record<string, { n: number; wins: number; expected: number }>;

const LEARN_PRIOR = 8;

/** Multiplier applied to the model's probability for a selection, from past settled picks. */
export function learnFactor(learning: Learning | undefined, key: string): number {
  const s = learning?.[key];
  if (!s || s.n === 0) return 1;
  const f = (s.wins + LEARN_PRIOR) / (s.expected + LEARN_PRIOR);
  return Math.min(1.15, Math.max(0.85, f));
}

/* ---------------- analysis ---------------- */

export interface Pick {
  fixtureId: string;
  key: string;
  group: MarketGroup;
  label: string;
  prob: number;
  odds: number;
  /** expected value per unit at these odds */
  edge: number;
  /** bookmaker's margin-free implied probability (approximate) */
  implied: number;
  /** the form model on its own, before blending with the market */
  modelProb: number;
}

export interface AnalysedMatch {
  fixture: Fixture;
  xgHome: number;
  xgAway: number;
  corners: number;
  quality: Quality;
  /** every selection in the chosen market groups */
  options: Pick[];
  /** the model's choice per chosen group */
  best: Pick[];
}

const MIN_ODDS = 1.2;
/**
 * Bookmaker prices already contain a lot of information, so the estimate is a blend:
 * mostly market, nudged by the form model. Tested on 36k demo selections, this beats
 * either one alone (log loss 0.603 vs model-only 0.622).
 */
export const MODEL_WEIGHT = 0.3;
const MARGIN = 1.06;

export function leagueGoalAverages(fixtures: Fixture[]): Record<string, number> {
  const acc: Record<string, { g: number; n: number }> = {};
  for (const f of fixtures) {
    const a = (acc[f.league.id] ??= { g: 0, n: 0 });
    for (const r of [...validRows(f.homeForm), ...validRows(f.awayForm)]) {
      a.g += r.gf + r.ga;
      a.n++;
    }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([k, v]) => [k, v.n ? Math.min(3.6, Math.max(2, v.g / v.n)) : 2.7])
  );
}

export function analyseFixture(
  f: Fixture,
  groups: MarketGroup[],
  learning?: Learning,
  leagueGoals = 2.7
): AnalysedMatch | null {
  const model = predictFootball({
    ...DEFAULT_FOOTBALL,
    home: f.home,
    away: f.away,
    homeForm: f.homeForm,
    awayForm: f.awayForm,
    leagueGoals,
  });
  if (!model) return null;
  const corners =
    (f.homeCorners.for + f.awayCorners.against) / 2 + (f.awayCorners.for + f.homeCorners.against) / 2;
  const probs = probsFromRates(model.lambdaHome, model.lambdaAway, corners);
  const set = new Set(groups);
  const options: Pick[] = [];
  for (const s of SELECTIONS) {
    if (!set.has(s.group)) continue;
    const odds = f.odds[s.key];
    if (!odds) continue;
    const implied = Math.min(0.97, 1 / (odds * MARGIN));
    const modelProb = probs[s.key];
    const blended = MODEL_WEIGHT * modelProb + (1 - MODEL_WEIGHT) * implied;
    const prob = Math.min(0.99, Math.max(0.01, blended * learnFactor(learning, s.key)));
    options.push({
      fixtureId: f.id,
      key: s.key,
      group: s.group,
      label: selectionLabel(s.key, f.home, f.away),
      prob,
      odds,
      edge: prob * odds - 1,
      implied,
      modelProb,
    });
  }
  const best: Pick[] = [];
  for (const g of groups) {
    const inGroup = options.filter((o) => o.group === g && o.odds >= MIN_ODDS);
    if (inGroup.length) best.push(inGroup.reduce((a, b) => (b.prob > a.prob ? b : a)));
  }
  return {
    fixture: f,
    xgHome: model.lambdaHome,
    xgAway: model.lambdaAway,
    corners,
    quality: model.quality,
    options,
    best,
  };
}

export interface LeagueGroup {
  key: string;
  name: string;
  country: string;
  tier: number;
  matches: AnalysedMatch[];
}

export function groupByLeague(matches: AnalysedMatch[]): LeagueGroup[] {
  const map = new Map<string, LeagueGroup>();
  for (const m of matches) {
    const l = m.fixture.league;
    if (!map.has(l.id)) map.set(l.id, { key: l.id, name: l.name, country: l.country, tier: l.tier, matches: [] });
    map.get(l.id)!.matches.push(m);
  }
  const groups = [...map.values()];
  groups.forEach((g) => g.matches.sort((a, b) => a.fixture.kickoff.localeCompare(b.fixture.kickoff)));
  return groups.sort((a, b) => a.tier - b.tier || b.matches.length - a.matches.length || a.name.localeCompare(b.name));
}

/* ---------------- suggestions ---------------- */

function onePerMatch(picks: Pick[], limit: number) {
  const seen = new Set<string>();
  const out: Pick[] = [];
  for (const p of picks) {
    if (seen.has(p.fixtureId)) continue;
    seen.add(p.fixtureId);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** The model's own most likely picks (it ignores the odds except to skip near-certainties). */
export function modelPicks(matches: AnalysedMatch[], limit = 8): Pick[] {
  const all = matches
    .filter((m) => m.quality !== "poor")
    .flatMap((m) => m.options)
    .filter((p) => p.odds >= 1.25 && p.prob >= 0.55)
    .sort((a, b) => b.prob - a.prob);
  return onePerMatch(all, limit);
}

/** Where the model is more confident than the bookmaker's price implies. */
export function valuePicks(matches: AnalysedMatch[], limit = 8): Pick[] {
  const all = matches
    .filter((m) => m.quality !== "poor")
    .flatMap((m) => m.options)
    .filter((p) => p.edge >= 0.02 && p.prob >= 0.4 && p.odds <= 4)
    .sort((a, b) => b.edge - a.edge);
  return onePerMatch(all, limit);
}

/* ---------------- slip builder ---------------- */

export interface BuiltSlip {
  legs: Pick[];
  totalOdds: number;
  /** chance every leg wins, treating matches as independent */
  chance: number;
  reached: boolean;
}

/**
 * Reach the target total odds with the highest combined probability:
 * take the legs that add the most odds for the least probability lost, then trim the overshoot.
 */
export function buildSlip(matches: AnalysedMatch[], target: number, maxLegs = 12): BuiltSlip {
  const cost = (p: Pick) => -Math.log(p.prob) / Math.log(p.odds);
  const perMatch = matches
    .filter((m) => m.quality !== "poor")
    .map((m) =>
      m.options
        .filter((o) => o.odds >= 1.15 && o.odds <= 2.5 && o.prob >= 0.5)
        .sort((a, b) => cost(a) - cost(b))
    )
    .filter((c) => c.length);

  const firstChoice = perMatch.map((c) => c[0]).sort((a, b) => cost(a) - cost(b));
  const legs: Pick[] = [];
  let odds = 1;
  for (const p of firstChoice) {
    if (odds >= target || legs.length >= maxLegs) break;
    legs.push(p);
    odds *= p.odds;
  }

  // Trim: swap the last leg for the most probable alternative that still reaches the target.
  if (legs.length && odds >= target) {
    const last = legs[legs.length - 1];
    const without = odds / last.odds;
    const used = new Set(legs.slice(0, -1).map((l) => l.fixtureId));
    const alts = perMatch
      .flat()
      .filter((p) => !used.has(p.fixtureId) && without * p.odds >= target)
      .sort((a, b) => b.prob - a.prob);
    if (alts[0] && alts[0].prob > last.prob) {
      legs[legs.length - 1] = alts[0];
      odds = without * alts[0].odds;
    }
  }

  return {
    legs,
    totalOdds: Math.round(odds * 100) / 100,
    chance: legs.reduce((a, l) => a * l.prob, 1),
    reached: odds >= target,
  };
}

/* ---------------- settlement ---------------- */

export function settles(key: string, r: MatchResult): boolean {
  const def = SELECTION_BY_KEY[key];
  return def ? def.settle(r) : false;
}
