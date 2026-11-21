/**
 * The calibrated estimator, built from what the backtest showed:
 *  - Priced markets (1X2, over/under 2.5): the sharp market is the best single estimate; the ratings
 *    model only nudges it by a tuned weight.
 *  - Goal markets without prices (BTTS, other lines, double chance, combos): derived from the goal
 *    expectations the market itself implies, blended with the ratings model.
 *  - Half-time: a fitted share of goals before the break.
 *  - Corners: negative binomial (corner counts swing more than Poisson allows), mean shrunk to the league.
 *  - Finally a per-market logistic recalibration fitted on past seasons.
 */
import { scoreMatrix } from "../models/football";
import { SELECTIONS, MatchResult } from "../research/markets";

export interface Params {
  /** weight of the ratings model against the market for priced markets */
  wPriced: number;
  /** weight of the ratings model against market-implied goals for unpriced goal markets */
  wGoals: number;
  /** share of goals scored before half-time */
  htShare: number;
  /** corners: mean = league + k·(team model − league); variance = μ + μ²/r */
  cornerShrink: number;
  cornerR: number;
  /** per market: p' = σ(a·logit(p) + b) */
  calib: Record<string, [number, number]>;
}

export const DEFAULT_PARAMS: Params = { wPriced: 0.1, wGoals: 0.35, htShare: 0.44, cornerShrink: 0.5, cornerR: 12, calib: {} };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (p: number) => Math.log(p / (1 - p));
const clip = (p: number) => Math.min(0.995, Math.max(0.005, p));

function markets(lh: number, la: number) {
  const m = scoreMatrix(lh, la);
  let h = 0, d = 0, o25 = 0;
  for (let i = 0; i < m.length; i++)
    for (let j = 0; j < m[i].length; j++) {
      if (i > j) h += m[i][j];
      else if (i === j) d += m[i][j];
      if (i + j > 2.5) o25 += m[i][j];
    }
  return { h, d, a: 1 - h - d, o25 };
}

/**
 * Goal expectations that reproduce the market's own prices (home/draw/away and over 2.5).
 * Coarse grid then local refinement; ~1ms per match.
 */
export function impliedGoals(pH: number, pA: number, pOver?: number, fallbackTotal = 2.7): { home: number; away: number } {
  let best = { home: 1.4, away: 1.1, err: Infinity };
  const fitErr = (lh: number, la: number) => {
    const q = markets(lh, la);
    const e1 = q.h - pH, e2 = q.a - pA;
    const e3 = pOver !== undefined ? q.o25 - pOver : 0;
    return e1 * e1 + e2 * e2 + (pOver !== undefined ? 2 * e3 * e3 : 0.02 * (lh + la - fallbackTotal) ** 2);
  };
  for (let t = 1.6; t <= 4.4; t += 0.2)
    for (let s = -2.4; s <= 2.4; s += 0.2) {
      const lh = (t + s) / 2, la = (t - s) / 2;
      if (lh < 0.1 || la < 0.1) continue;
      const e = fitErr(lh, la);
      if (e < best.err) best = { home: lh, away: la, err: e };
    }
  let step = 0.1;
  for (let it = 0; it < 24; it++) {
    let improved = false;
    for (const [dh, da] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, -step], [-step, step]]) {
      const lh = best.home + dh, la = best.away + da;
      if (lh < 0.08 || la < 0.08) continue;
      const e = fitErr(lh, la);
      if (e < best.err) {
        best = { home: lh, away: la, err: e };
        improved = true;
      }
    }
    if (!improved) step /= 2;
    if (step < 0.002) break;
  }
  return { home: best.home, away: best.away };
}

/** Negative binomial P(X ≤ k) with mean μ and size r. */
function nbCdf(k: number, mu: number, r: number) {
  const p = r / (r + mu);
  let term = Math.pow(p, r);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= ((i - 1 + r) / i) * (1 - p);
    sum += term;
  }
  return Math.min(1, sum);
}

export interface Inputs {
  /** ratings model expected goals */
  model: { home: number; away: number };
  /** market fair probabilities, when priced */
  fair?: { home?: number; draw?: number; away?: number; "over2.5"?: number };
  leagueGoals: number;
  /** corners: team-model expected total and league average total */
  cornersModel: number;
  cornersLeague: number;
  /** precomputed impliedGoals(), to save time in batch runs */
  implied?: { home: number; away: number };
}

export function estimate(x: Inputs, P: Params = DEFAULT_PARAMS): Record<string, number> {
  const f = x.fair;
  const hasOdds = f?.home !== undefined && f?.away !== undefined;
  const mk = hasOdds ? x.implied ?? impliedGoals(f!.home!, f!.away!, f!["over2.5"], x.leagueGoals) : undefined;
  // blended goal expectations for the score grid
  const w = hasOdds ? P.wGoals : 1;
  const lh = mk ? w * x.model.home + (1 - w) * mk.home : x.model.home;
  const la = mk ? w * x.model.away + (1 - w) * mk.away : x.model.away;
  const g = scoreMatrix(lh, la);
  const ht = scoreMatrix(lh * P.htShare, la * P.htShare);
  const out: Record<string, number> = {};
  const res = (h: number, a: number, hh: number, ha: number): MatchResult => ({ home: h, away: a, htHome: hh, htAway: ha, corners: 0 });
  for (const s of SELECTIONS) {
    if (s.group === "corners") continue;
    const grid = s.group === "htBtts" || s.group === "htGoals" ? ht : g;
    const isHt = grid === ht;
    let acc = 0;
    for (let i = 0; i < grid.length; i++)
      for (let j = 0; j < grid[i].length; j++) if (s.settle(isHt ? res(0, 0, i, j) : res(i, j, 0, 0))) acc += grid[i][j];
    out[s.key] = acc;
  }
  // priced markets: lean on the market itself
  if (f?.home !== undefined && f.draw !== undefined && f.away !== undefined) {
    const m1 = markets(x.model.home, x.model.away);
    out.home = P.wPriced * m1.h + (1 - P.wPriced) * f.home;
    out.draw = P.wPriced * m1.d + (1 - P.wPriced) * f.draw;
    out.away = P.wPriced * m1.a + (1 - P.wPriced) * f.away;
    out.dc1X = out.home + out.draw;
    out.dcX2 = out.away + out.draw;
    out.dc12 = out.home + out.away;
  }
  if (f?.["over2.5"] !== undefined) {
    const m1 = markets(x.model.home, x.model.away);
    out["over2.5"] = P.wPriced * m1.o25 + (1 - P.wPriced) * f["over2.5"];
    out["under2.5"] = 1 - out["over2.5"];
  }
  // corners
  const mu = x.cornersLeague + P.cornerShrink * (x.cornersModel - x.cornersLeague);
  for (const line of [8.5, 9.5, 10.5]) {
    const under = nbCdf(Math.floor(line), mu, P.cornerR);
    out[`cUnder${line}`] = under;
    out[`cOver${line}`] = 1 - under;
  }
  // final recalibration, keeping complementary pairs consistent
  for (const [k, [a, b]] of Object.entries(P.calib)) if (out[k] !== undefined) out[k] = sigmoid(a * logit(clip(out[k])) + b);
  const pairs: [string, string][] = [["bttsYes", "bttsNo"], ["over1.5", "under1.5"], ["over3.5", "under3.5"], ["htBttsYes", "htBttsNo"], ["htOver0.5", "htUnder0.5"], ["cOver8.5", "cUnder8.5"], ["cOver9.5", "cUnder9.5"], ["cOver10.5", "cUnder10.5"]];
  for (const [a, b] of pairs) if (P.calib[a]) out[b] = 1 - out[a];
  return out;
}

/** Fits σ(a·logit(p)+b) by Newton's method on (p, y) pairs. */
export function fitCalibration(ps: number[], ys: number[]): [number, number] {
  let a = 1, b = 0;
  const z = ps.map((p) => logit(clip(p)));
  for (let it = 0; it < 30; it++) {
    let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
    for (let i = 0; i < z.length; i++) {
      const q = sigmoid(a * z[i] + b);
      const e = q - ys[i];
      const w = q * (1 - q);
      ga += e * z[i];
      gb += e;
      haa += w * z[i] * z[i];
      hab += w * z[i];
      hbb += w;
    }
    // small ridge toward the identity map so thin markets don't overfit
    const lam = 20;
    ga += lam * (a - 1);
    gb += lam * b;
    haa += lam;
    hbb += lam;
    const det = haa * hbb - hab * hab;
    if (Math.abs(det) < 1e-12) break;
    a -= (hbb * ga - hab * gb) / det;
    b -= (haa * gb - hab * ga) / det;
  }
  return [a, b];
}
