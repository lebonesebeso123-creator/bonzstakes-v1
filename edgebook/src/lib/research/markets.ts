import { scoreMatrix } from "../models/football";

/** Market groups the user can research. One pick per match; combos are single picks. */
export type MarketGroup = "1x2" | "dc" | "btts" | "goals" | "corners" | "htBtts" | "htGoals" | "combo";

export const MARKET_GROUPS: { id: MarketGroup; label: string; short: string }[] = [
  { id: "1x2", label: "Match winner", short: "1X2" },
  { id: "dc", label: "Double chance", short: "DC" },
  { id: "btts", label: "Both teams to score", short: "BTTS" },
  { id: "goals", label: "Total goals", short: "Goals" },
  { id: "corners", label: "Corners", short: "Corners" },
  { id: "htBtts", label: "1st half BTTS", short: "HT BTTS" },
  { id: "htGoals", label: "1st half goals", short: "HT goals" },
  { id: "combo", label: "Combos", short: "Combo" },
];

export const GROUP_LABEL = Object.fromEntries(MARKET_GROUPS.map((g) => [g.id, g.label])) as Record<
  MarketGroup,
  string
>;

/** Final score data needed to settle any selection. */
export interface MatchResult {
  home: number;
  away: number;
  htHome: number;
  htAway: number;
  corners: number;
  /** data the source didn't provide; selections that need it are voided */
  missing?: ("ht" | "corners")[];
}

export interface SelectionDef {
  key: string;
  group: MarketGroup;
  /** label with {H}/{A} placeholders for team names */
  label: string;
  settle: (r: MatchResult) => boolean;
}

const total = (r: MatchResult) => r.home + r.away;
const ht = (r: MatchResult) => r.htHome + r.htAway;

export const SELECTIONS: SelectionDef[] = [
  { key: "home", group: "1x2", label: "{H} to win", settle: (r) => r.home > r.away },
  { key: "draw", group: "1x2", label: "Draw", settle: (r) => r.home === r.away },
  { key: "away", group: "1x2", label: "{A} to win", settle: (r) => r.away > r.home },
  { key: "dc1X", group: "dc", label: "{H} or draw", settle: (r) => r.home >= r.away },
  { key: "dcX2", group: "dc", label: "{A} or draw", settle: (r) => r.away >= r.home },
  { key: "dc12", group: "dc", label: "Either team to win", settle: (r) => r.home !== r.away },
  { key: "bttsYes", group: "btts", label: "BTTS: Yes", settle: (r) => r.home > 0 && r.away > 0 },
  { key: "bttsNo", group: "btts", label: "BTTS: No", settle: (r) => r.home === 0 || r.away === 0 },
  { key: "over1.5", group: "goals", label: "Over 1.5 goals", settle: (r) => total(r) > 1.5 },
  { key: "under1.5", group: "goals", label: "Under 1.5 goals", settle: (r) => total(r) < 1.5 },
  { key: "over2.5", group: "goals", label: "Over 2.5 goals", settle: (r) => total(r) > 2.5 },
  { key: "under2.5", group: "goals", label: "Under 2.5 goals", settle: (r) => total(r) < 2.5 },
  { key: "over3.5", group: "goals", label: "Over 3.5 goals", settle: (r) => total(r) > 3.5 },
  { key: "under3.5", group: "goals", label: "Under 3.5 goals", settle: (r) => total(r) < 3.5 },
  { key: "cOver8.5", group: "corners", label: "Over 8.5 corners", settle: (r) => r.corners > 8.5 },
  { key: "cUnder8.5", group: "corners", label: "Under 8.5 corners", settle: (r) => r.corners < 8.5 },
  { key: "cOver9.5", group: "corners", label: "Over 9.5 corners", settle: (r) => r.corners > 9.5 },
  { key: "cUnder9.5", group: "corners", label: "Under 9.5 corners", settle: (r) => r.corners < 9.5 },
  { key: "cOver10.5", group: "corners", label: "Over 10.5 corners", settle: (r) => r.corners > 10.5 },
  { key: "cUnder10.5", group: "corners", label: "Under 10.5 corners", settle: (r) => r.corners < 10.5 },
  { key: "htBttsYes", group: "htBtts", label: "1st half BTTS: Yes", settle: (r) => r.htHome > 0 && r.htAway > 0 },
  { key: "htBttsNo", group: "htBtts", label: "1st half BTTS: No", settle: (r) => r.htHome === 0 || r.htAway === 0 },
  { key: "htOver0.5", group: "htGoals", label: "1st half over 0.5", settle: (r) => ht(r) > 0.5 },
  { key: "htUnder0.5", group: "htGoals", label: "1st half under 0.5", settle: (r) => ht(r) < 0.5 },
  { key: "htOver1.5", group: "htGoals", label: "1st half over 1.5", settle: (r) => ht(r) > 1.5 },
  { key: "homeBtts", group: "combo", label: "{H} win & BTTS", settle: (r) => r.home > r.away && r.away > 0 },
  { key: "awayBtts", group: "combo", label: "{A} win & BTTS", settle: (r) => r.away > r.home && r.home > 0 },
  { key: "homeO15", group: "combo", label: "{H} win & over 1.5", settle: (r) => r.home > r.away && total(r) > 1.5 },
  { key: "awayO15", group: "combo", label: "{A} win & over 1.5", settle: (r) => r.away > r.home && total(r) > 1.5 },
  { key: "bttsO25", group: "combo", label: "BTTS & over 2.5", settle: (r) => r.home > 0 && r.away > 0 && total(r) > 2.5 },
];

export const SELECTION_BY_KEY = Object.fromEntries(SELECTIONS.map((s) => [s.key, s])) as Record<
  string,
  SelectionDef
>;

export function selectionLabel(key: string, home: string, away: string) {
  return (SELECTION_BY_KEY[key]?.label ?? key).replace("{H}", home).replace("{A}", away);
}

/** Share of goals scored before half-time (long-run average across top leagues). */
export const HT_SHARE = 0.44;

function poissonCdf(k: number, mean: number) {
  let term = Math.exp(-mean);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term = (term * mean) / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/** Every selection's probability from expected goals and expected total corners. */
export function probsFromRates(lh: number, la: number, corners: number): Record<string, number> {
  const m = scoreMatrix(lh, la);
  const hm = scoreMatrix(lh * HT_SHARE, la * HT_SHARE);
  const p: Record<string, number> = {};
  const r = (res: MatchResult) => res;
  // full-time markets + combos: integrate the score grid
  for (const s of SELECTIONS) {
    if (s.group === "corners" || s.group === "htBtts" || s.group === "htGoals") continue;
    let acc = 0;
    for (let h = 0; h < m.length; h++)
      for (let a = 0; a < m[h].length; a++)
        if (s.settle(r({ home: h, away: a, htHome: 0, htAway: 0, corners: 0 }))) acc += m[h][a];
    p[s.key] = acc;
  }
  // half-time markets: half-time score grid
  for (const s of SELECTIONS) {
    if (s.group !== "htBtts" && s.group !== "htGoals") continue;
    let acc = 0;
    for (let h = 0; h < hm.length; h++)
      for (let a = 0; a < hm[h].length; a++)
        if (s.settle(r({ home: 0, away: 0, htHome: h, htAway: a, corners: 0 }))) acc += hm[h][a];
    p[s.key] = acc;
  }
  // corners: Poisson on the total
  for (const line of [8.5, 9.5, 10.5]) {
    const under = poissonCdf(Math.floor(line), corners);
    p[`cUnder${line}`] = under;
    p[`cOver${line}`] = 1 - under;
  }
  return p;
}

/** Outcome sets that together cover every result, so their prices can have the margin removed. */
export const COMPLEMENTS: string[][] = [
  ["home", "draw", "away"],
  ["bttsYes", "bttsNo"],
  ["over1.5", "under1.5"],
  ["over2.5", "under2.5"],
  ["over3.5", "under3.5"],
  ["cOver8.5", "cUnder8.5"],
  ["cOver9.5", "cUnder9.5"],
  ["cOver10.5", "cUnder10.5"],
  ["htBttsYes", "htBttsNo"],
  ["htOver0.5", "htUnder0.5"],
];

/** Assumed margin on prices that can't be normalised against their complement. */
export const TYPICAL_MARGIN = 1.06;

/**
 * The bookmaker's margin-free probability for every priced selection.
 * Complete outcome sets are normalised; double chance is rebuilt from 1X2; anything else
 * gets a typical margin removed.
 */
export function fairFromOdds(odds: Record<string, number | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  const done = new Set<string>();
  for (const set of COMPLEMENTS) {
    if (!set.every((k) => odds[k] && odds[k]! > 1)) continue;
    const raw = set.map((k) => 1 / odds[k]!);
    const sum = raw.reduce((a, b) => a + b, 0);
    set.forEach((k, i) => {
      out[k] = raw[i] / sum;
      done.add(k);
    });
  }
  if (out.home !== undefined) {
    out.dc1X = out.home + out.draw;
    out.dcX2 = out.away + out.draw;
    out.dc12 = out.home + out.away;
    ["dc1X", "dcX2", "dc12"].forEach((k) => done.add(k));
  }
  for (const [k, o] of Object.entries(odds)) {
    if (done.has(k) || !o || o <= 1) continue;
    out[k] = Math.min(0.97, 1 / (o * TYPICAL_MARGIN));
  }
  return out;
}
