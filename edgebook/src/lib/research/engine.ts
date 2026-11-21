import { predictFootball, DEFAULT_FOOTBALL, validRows } from "../models/football";
import { Quality } from "../types";
import { Fixture } from "./data";
import {
  MarketGroup,
  MatchResult,
  SELECTIONS,
  SELECTION_BY_KEY,
  TYPICAL_MARGIN,
  fairFromOdds,
  probsFromRates,
  selectionLabel,
} from "./markets";

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

const LEARN_PRIOR = 20;
/** No adjustment until a selection has this many settled picks: below that it's mostly luck. */
export const LEARN_MIN = 10;

/** Multiplier applied to the model's probability for a selection, from past settled picks. */
export function learnFactor(learning: Learning | undefined, key: string): number {
  const s = learning?.[key];
  if (!s || s.n < LEARN_MIN) return 1;
  const f = (s.wins + LEARN_PRIOR) / (s.expected + LEARN_PRIOR);
  return Math.min(1.15, Math.max(0.85, f));
}

type Settled = { fixtureId?: string; key: string; prob: number; status: string };

/**
 * Learning stats from settled picks: your slip legs plus the app's own daily picks.
 * A selection on the same match is counted once. Won/lost only; voids don't count.
 */
export function learningFrom(
  bets: { placedAt: string; legs?: Settled[] }[],
  since?: string,
  tracked: (Settled & { recordedAt: string })[] = []
): Learning {
  const out: Learning = {};
  const seen = new Set<string>();
  const add = (l: Settled) => {
    if (l.status !== "won" && l.status !== "lost") return;
    if (l.fixtureId) {
      const id = `${l.fixtureId}|${l.key}`;
      if (seen.has(id)) return;
      seen.add(id);
    }
    const s = (out[l.key] ??= { n: 0, wins: 0, expected: 0 });
    s.n++;
    s.wins += l.status === "won" ? 1 : 0;
    s.expected += l.prob;
  };
  for (const t of tracked) if (!since || t.recordedAt >= since) add(t);
  for (const b of bets) {
    if (!b.legs || (since && b.placedAt < since)) continue;
    b.legs.forEach(add);
  }
  return out;
}

/** Local calendar day, YYYY-MM-DD. */
export const localDay = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/* ---------------- analysis ---------------- */

export interface Pick {
  fixtureId: string;
  key: string;
  group: MarketGroup;
  label: string;
  prob: number;
  /** bookmaker price, or an estimate of it when the market isn't priced (see `priced`) */
  odds: number;
  /** true when `odds` is a real bookmaker price */
  priced: boolean;
  /** 1 / prob: the price at which this pick breaks even */
  fairOdds: number;
  /** expected value per unit at the bookmaker price; null when there is no real price */
  edge: number | null;
  /** bookmaker's margin-free probability, when priced */
  implied: number | null;
  /** the form model on its own, before blending */
  modelProb: number;
}

/** Value flag threshold: estimate must beat the price by at least this much. */
export const VALUE_EDGE = 0.02;
export const isValue = (p: Pick) => p.edge !== null && p.edge >= VALUE_EDGE;

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
/** With no price to lean on, the model is pulled 35% toward an average match in the league. */
export const UNPRICED_SHRINK = 0.35;

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
  const hasCorners = f.hasCorners !== false;
  const corners = hasCorners
    ? (f.homeCorners.for + f.awayCorners.against) / 2 + (f.awayCorners.for + f.homeCorners.against) / 2
    : 10;
  const probs = probsFromRates(model.lambdaHome, model.lambdaAway, corners);
  // an "average match" in this league, used to tame model-only estimates
  const ha = 1.25;
  const base = probsFromRates((leagueGoals * ha) / (1 + ha), leagueGoals / (1 + ha), 10);
  const fair = fairFromOdds(f.odds);
  const set = new Set(groups);
  const options: Pick[] = [];
  for (const s of SELECTIONS) {
    if (!set.has(s.group)) continue;
    if (s.group === "corners" && !hasCorners) continue;
    const modelProb = probs[s.key];
    const market = fair[s.key];
    const raw =
      market !== undefined
        ? MODEL_WEIGHT * modelProb + (1 - MODEL_WEIGHT) * market
        : (1 - UNPRICED_SHRINK) * modelProb + UNPRICED_SHRINK * base[s.key];
    const prob = Math.min(0.99, Math.max(0.01, raw * learnFactor(learning, s.key)));
    const price = f.odds[s.key];
    const priced = !!price && price > 1;
    const odds = priced ? price! : Math.max(1.01, Math.round((1 / (prob * TYPICAL_MARGIN)) * 100) / 100);
    options.push({
      fixtureId: f.id,
      key: s.key,
      group: s.group,
      label: selectionLabel(s.key, f.home, f.away),
      prob,
      odds,
      priced,
      fairOdds: Math.round((1 / prob) * 100) / 100,
      edge: priced ? prob * odds - 1 : null,
      implied: market ?? null,
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
    .filter((p) => isValue(p) && p.prob >= 0.4 && p.odds <= 4)
    .sort((a, b) => b.edge! - a.edge!);
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

export type Outcome = "won" | "lost" | "void";

/** Settles one selection. Voids it when the source lacks the data it needs (e.g. corners). */
export function settleOutcome(key: string, r: MatchResult): Outcome {
  const def = SELECTION_BY_KEY[key];
  if (!def) return "void";
  const needs = def.group === "corners" ? "corners" : def.group === "htBtts" || def.group === "htGoals" ? "ht" : null;
  if (needs && r.missing?.includes(needs)) return "void";
  return def.settle(r) ? "won" : "lost";
}

export function settles(key: string, r: MatchResult): boolean {
  return settleOutcome(key, r) === "won";
}
