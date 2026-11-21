/**
 * Walk-forward backtest on real football-data.co.uk seasons.
 * Every prediction uses only matches played before kick-off.
 *   npx tsx scripts/backtest.ts <rawDir> [--json out.json]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { FdMatch, fair2, fair3, parseFd, played } from "../edgebook/src/lib/fd/csv";
import { DEFAULT_FIT, FitOptions, Ratings, expected, fitRatings } from "../edgebook/src/lib/fd/model";
import { DEFAULT_FOOTBALL, predictFootball } from "../edgebook/src/lib/models/football";
import { SELECTIONS, probsFromRates, MatchResult } from "../edgebook/src/lib/research/markets";
import { FormMatch, OppTier } from "../edgebook/src/lib/types";

export interface Row {
  season: string;
  div: string;
  t: string;
  day: string;
  match: string;
  y: Record<string, 0 | 1>;
  m0: Record<string, number>; // the app's current form model
  m1: Record<string, number>; // season ratings model
  base: Record<string, number>; // an average match in this league
  mkt?: Record<string, number>; // market average, margin removed (pre-match)
  sharp?: Record<string, number>; // Pinnacle / Betfair Exchange, margin removed (pre-match)
  close?: Record<string, number>; // sharp closing line, margin removed
  soft?: Record<string, number>; // Bet365 prices (stand-in for Betway)
  best?: Record<string, number>; // best price in the market
  conf: number;
  /** raw ingredients for the calibrated estimator */
  lam: { home: number; away: number };
  cm: number;
  cl: number;
  lg: number;
}

const seasonOf = (iso: string) => {
  const d = new Date(iso);
  const y = d.getUTCFullYear() % 100;
  const s = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${String(s).padStart(2, "0")}${String(s + 1).padStart(2, "0")}`;
};

export function load(raw: string): FdMatch[] {
  const all: FdMatch[] = [];
  for (const s of readdirSync(raw).filter((x) => /^\d{4}$/.test(x)).sort())
    for (const f of readdirSync(`${raw}/${s}`)) all.push(...parseFd(readFileSync(`${raw}/${s}/${f}`, "latin1")));
  return all.filter(played).sort((a, b) => a.t.localeCompare(b.t));
}

function outcome(m: FdMatch): MatchResult {
  return { home: m.fh!, away: m.fa!, htHome: m.hh ?? 0, htAway: m.ha ?? 0, corners: (m.hc ?? 0) + (m.ac ?? 0) };
}

function oddsMaps(m: FdMatch) {
  const f3 = (o?: { h: number; d: number; a: number }) => {
    const f = fair3(o);
    return f ? { home: f.h, draw: f.d, away: f.a, dc1X: f.h + f.d, dcX2: f.a + f.d, dc12: f.h + f.a } : undefined;
  };
  const f2 = (o?: { o: number; u: number }) => {
    const f = fair2(o);
    return f ? { "over2.5": f.o, "under2.5": f.u } : undefined;
  };
  const join = (a?: Record<string, number>, b?: Record<string, number>) => (a || b ? { ...(a ?? {}), ...(b ?? {}) } : undefined);
  const price = (o3?: { h: number; d: number; a: number }, o2?: { o: number; u: number }) =>
    o3 || o2
      ? { ...(o3 ? { home: o3.h, draw: o3.d, away: o3.a } : {}), ...(o2 ? { "over2.5": o2.o, "under2.5": o2.u } : {}) }
      : undefined;
  const sharp3 = m.bfe ?? m.pin;
  const sharpOU = m.bfeOU ?? m.pinOU;
  const close3 = m.bfeC ?? m.pinC ?? m.avgC;
  const closeOU = m.bfeCOU ?? m.pinCOU ?? m.avgCOU;
  return {
    mkt: join(f3(m.avg), f2(m.avgOU)),
    sharp: join(f3(sharp3), f2(sharpOU)),
    close: join(f3(close3), f2(closeOU)),
    soft: price(m.b365, m.b365OU),
    best: price(m.max, m.maxOU),
  };
}

export function run(all: FdMatch[], fit: FitOptions = DEFAULT_FIT, from = "2223"): Row[] {
  const rows: Row[] = [];
  const divs = [...new Set(all.map((m) => m.div))];
  for (const div of divs) {
    const ms = all.filter((m) => m.div === div);
    const history: FdMatch[] = [];
    const byTeam = new Map<string, FdMatch[]>();
    const cache = new Map<string, { g: Ratings; c: Ratings }>();
    for (const m of ms) {
      const season = seasonOf(m.t);
      const day = m.t.slice(0, 10);
      if (season >= from) {
        const at = Date.parse(`${day}T00:00:00Z`);
        if (!cache.has(day)) {
          const known = new Set<string>();
          for (const h of history) if (at - Date.parse(h.t) < 400 * 86400_000) known.add(h.home), known.add(h.away);
          cache.set(day, { g: fitRatings(history, at, fit, "goals", known), c: fitRatings(history, at, { ...fit, newcomer: [1, 1] }, "corners") });
        }
        const R = cache.get(day)!;
        const hist = (t: string) => byTeam.get(t) ?? [];
        // ---- M0: exactly what the app does today: last 10 matches + Poisson/Dixon-Coles
        const recent = history.slice(-380);
        const leagueGoals = recent.length ? recent.reduce((a, x) => a + x.fh! + x.fa!, 0) / recent.length : 2.7;
        const table = new Map<string, number>();
        const seasonMs = history.filter((x) => seasonOf(x.t) === season);
        const src = seasonMs.length >= 30 ? seasonMs : history.filter((x) => Date.parse(x.t) > at - 400 * 86400_000);
        for (const x of src) {
          table.set(x.home, (table.get(x.home) ?? 0) + (x.fh! > x.fa! ? 3 : x.fh === x.fa ? 1 : 0));
          table.set(x.away, (table.get(x.away) ?? 0) + (x.fa! > x.fh! ? 3 : x.fh === x.fa ? 1 : 0));
        }
        const order = [...table.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
        const tierOf = (t: string): OppTier => {
          const i = order.indexOf(t);
          if (i < 0) return "weak";
          return i < order.length / 3 ? "strong" : i < (2 * order.length) / 3 ? "avg" : "weak";
        };
        const form = (team: string): FormMatch[] =>
          hist(team)
            .slice(-10)
            .reverse()
            .map((x) => {
              const home = x.home === team;
              return { gf: String(home ? x.fh : x.fa), ga: String(home ? x.fa : x.fh), venue: home ? "H" : "A", opp: tierOf(home ? x.away : x.home) };
            });
        const cAvg = (team: string) => {
          const l = hist(team).slice(-8);
          if (!l.length) return { f: 5, a: 5 };
          return {
            f: l.reduce((s, x) => s + (x.home === team ? x.hc ?? 5 : x.ac ?? 5), 0) / l.length,
            a: l.reduce((s, x) => s + (x.home === team ? x.ac ?? 5 : x.hc ?? 5), 0) / l.length,
          };
        };
        const fm = predictFootball({ ...DEFAULT_FOOTBALL, home: m.home, away: m.away, homeForm: form(m.home), awayForm: form(m.away), leagueGoals });
        const ch = cAvg(m.home), ca = cAvg(m.away);
        const corners0 = (ch.f + ca.a) / 2 + (ca.f + ch.a) / 2;
        // ---- M1: season ratings
        const e = expected(R.g, m.home, m.away, fit.newcomer);
        const ec = expected(R.c, m.home, m.away, [1, 1]);
        const ha = 1.25;
        const base = probsFromRates((leagueGoals * ha) / (1 + ha), leagueGoals / (1 + ha), R.c.muHome + R.c.muAway);
        if (fm) {
          const o = outcome(m);
          const y: Record<string, 0 | 1> = {};
          for (const s of SELECTIONS) y[s.key] = s.settle(o) ? 1 : 0;
          rows.push({
            season,
            div,
            t: m.t,
            day,
            match: `${m.home} v ${m.away}`,
            y,
            m0: probsFromRates(fm.lambdaHome, fm.lambdaAway, corners0),
            m1: probsFromRates(e.home, e.away, ec.home + ec.away),
            base,
            ...oddsMaps(m),
            conf: e.confidence,
            lam: { home: e.home, away: e.away },
            cm: ec.home + ec.away,
            cl: R.c.muHome + R.c.muAway,
            lg: leagueGoals,
          });
        }
      }
      history.push(m);
      for (const t of [m.home, m.away]) {
        if (!byTeam.has(t)) byTeam.set(t, []);
        byTeam.get(t)!.push(m);
      }
    }
  }
  return rows.sort((a, b) => a.t.localeCompare(b.t));
}

/* ---------------- scoring ---------------- */

const clip = (p: number) => Math.min(0.995, Math.max(0.005, p));
export const ll = (p: number, y: number) => -(y * Math.log(clip(p)) + (1 - y) * Math.log(1 - clip(p)));

export function score(rows: Row[], key: string, f: (r: Row) => number | undefined) {
  let s = 0, n = 0, b = 0;
  for (const r of rows) {
    const p = f(r);
    if (p === undefined || !Number.isFinite(p)) continue;
    s += ll(p, r.y[key]);
    b += (p - r.y[key]) ** 2;
    n++;
  }
  return { logloss: n ? s / n : NaN, brier: n ? b / n : NaN, n };
}

if (process.argv[1]?.endsWith("backtest.ts")) {
  const raw = process.argv[2] ?? "data/raw";
  const t0 = Date.now();
  const all = load(raw);
  const rows = run(all);
  console.log(`matches ${all.length}, predicted ${rows.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const out = process.argv.indexOf("--json");
  if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(rows));
}
