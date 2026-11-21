/**
 * Scores a strategy on backtest rows: probability quality per market, the app's daily picks,
 * value picks and sharp-vs-soft bets.  npx tsx scripts/report.ts rows.json
 */
import { readFileSync } from "node:fs";
import type { Row } from "./backtest";
import { ll } from "./backtest";
import { SELECTION_BY_KEY } from "../edgebook/src/lib/research/markets";

export type Prob = (r: Row, key: string) => number | undefined;

export const PRICED = ["home", "draw", "away", "over2.5", "under2.5"];
export const ALL_KEYS = Object.keys(SELECTION_BY_KEY);

/** The app today: 30% model / 70% market where priced, model shrunk 35% to league average elsewhere. */
export const appNow: Prob = (r, k) => {
  const mk = r.mkt?.[k];
  return mk !== undefined ? 0.3 * r.m0[k] + 0.7 * mk : 0.65 * r.m0[k] + 0.35 * r.base[k];
};

export function quality(rows: Row[], keys: string[], fns: Record<string, Prob>) {
  const out: Record<string, Record<string, number>> = {};
  for (const k of keys) {
    out[k] = {};
    for (const [name, f] of Object.entries(fns)) {
      let s = 0, n = 0;
      for (const r of rows) {
        const p = f(r, k);
        if (p === undefined || !Number.isFinite(p)) continue;
        s += ll(p, r.y[k]);
        n++;
      }
      out[k][name] = n ? +(s / n).toFixed(4) : NaN;
    }
  }
  return out;
}

/** Calibration: predicted vs actual hit rate by probability bucket. */
export function calibration(rows: Row[], keys: string[], f: Prob) {
  const b = new Map<number, { p: number; y: number; n: number }>();
  for (const r of rows)
    for (const k of keys) {
      const p = f(r, k);
      if (p === undefined) continue;
      const i = Math.min(9, Math.floor(p * 10));
      const x = b.get(i) ?? { p: 0, y: 0, n: 0 };
      x.p += p;
      x.y += r.y[k];
      x.n++;
      b.set(i, x);
    }
  return [...b.entries()].sort((a, c) => a[0] - c[0]).map(([i, x]) => ({ bucket: `${i * 10}-${i * 10 + 10}%`, n: x.n, predicted: +(x.p / x.n).toFixed(3), actual: +(x.y / x.n).toFixed(3) }));
}

export interface PickOpts {
  perDay: number;
  minProb: number;
  minOdds: number;
  keys?: string[];
  /** price used for returns: soft (Bet365) by default */
  price?: "soft" | "best";
  valueEdge?: number; // when set: value picks (priced only, edge ≥ this)
  maxOdds?: number;
}

/** Simulates the app's daily picks: one per match, ranked by chance (or by edge for value picks). */
export function picks(rows: Row[], f: Prob, o: PickOpts) {
  const byDay = new Map<string, Row[]>();
  rows.forEach((r) => byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]));
  let n = 0, won = 0, exp = 0, staked = 0, ret = 0, clvSum = 0, clvN = 0;
  const byKey = new Map<string, { n: number; won: number; exp: number; staked: number; ret: number }>();
  const byDiv = new Map<string, { n: number; won: number; exp: number; staked: number; ret: number }>();
  for (const [, day] of byDay) {
    const cands: { r: Row; k: string; p: number; odds?: number; edge?: number }[] = [];
    for (const r of day) {
      for (const k of o.keys ?? ALL_KEYS) {
        const p = f(r, k);
        if (p === undefined) continue;
        const odds = r[o.price ?? "soft"]?.[k];
        const est = odds ?? 1 / (p * 1.06);
        if (est < o.minOdds || p < o.minProb) continue;
        if (o.maxOdds && est > o.maxOdds) continue;
        if (o.valueEdge !== undefined) {
          if (!odds) continue;
          const edge = p * odds - 1;
          if (edge < o.valueEdge) continue;
          cands.push({ r, k, p, odds, edge });
        } else cands.push({ r, k, p, odds });
      }
    }
    cands.sort((a, b) => (o.valueEdge !== undefined ? b.edge! - a.edge! : b.p - a.p));
    const used = new Set<string>();
    let c = 0;
    for (const x of cands) {
      if (c >= o.perDay) break;
      if (used.has(x.r.match)) continue;
      used.add(x.r.match);
      c++;
      const y = x.r.y[x.k];
      n++;
      won += y;
      exp += x.p;
      const add = (m: Map<string, { n: number; won: number; exp: number; staked: number; ret: number }>, key: string) => {
        const s = m.get(key) ?? { n: 0, won: 0, exp: 0, staked: 0, ret: 0 };
        s.n++;
        s.won += y;
        s.exp += x.p;
        if (x.odds) {
          s.staked++;
          s.ret += y * x.odds;
        }
        m.set(key, s);
      };
      add(byKey, SELECTION_BY_KEY[x.k].group);
      add(byDiv, x.r.div);
      if (x.odds) {
        staked++;
        ret += y * x.odds;
        const cl = x.r.close?.[x.k];
        if (cl) {
          clvSum += x.odds * cl - 1;
          clvN++;
        }
      }
    }
  }
  const fmt = (m: Map<string, { n: number; won: number; exp: number; staked: number; ret: number }>) =>
    Object.fromEntries(
      [...m.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .map(([k, s]) => [k, { n: s.n, hit: +(s.won / s.n).toFixed(3), expected: +(s.exp / s.n).toFixed(3), roi: s.staked ? +(s.ret / s.staked - 1).toFixed(3) : null }])
    );
  return {
    picks: n,
    winRatio: +(won / n).toFixed(3),
    expected: +(exp / n).toFixed(3),
    pricedBets: staked,
    roi: staked ? +(ret / staked - 1).toFixed(4) : null,
    clv: clvN ? +(clvSum / clvN).toFixed(4) : null,
    byMarket: fmt(byKey),
    byLeague: fmt(byDiv),
  };
}

if (process.argv[1]?.endsWith("report.ts")) {
  const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const test = rows.filter((r) => r.season >= "2425");
  console.log("rows", rows.length, "test (2024/25 onward)", test.length);
  console.log("\n== CURRENT APP: daily top 10 'most likely' picks (test seasons)");
  console.log(JSON.stringify(picks(test, appNow, { perDay: 10, minProb: 0.55, minOdds: 1.25 }), null, 1));
  console.log("\n== CURRENT APP: daily top 5 'value' picks at Bet365 prices");
  console.log(JSON.stringify(picks(test, appNow, { perDay: 5, minProb: 0.4, minOdds: 1.2, maxOdds: 4, valueEdge: 0.02 }), null, 1));
  console.log("\n== Probability quality (log loss, lower is better), test seasons");
  console.log(
    quality(test, [...PRICED, "bttsYes", "over1.5", "over3.5", "cOver9.5", "htBttsYes", "htOver0.5"], {
      app: appNow,
      m0: (r, k) => r.m0[k],
      m1: (r, k) => r.m1[k],
      base: (r, k) => r.base[k],
      market: (r, k) => r.mkt?.[k],
      sharp: (r, k) => r.sharp?.[k],
      closing: (r, k) => r.close?.[k],
    })
  );
  console.log("\n== Calibration of the app's estimates (all markets, test)");
  console.table(calibration(test, ALL_KEYS, appNow));
}
