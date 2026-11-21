/**
 * Turns the raw football-data.co.uk files into the app's data file (public/data/live.json):
 * upcoming fixtures with odds and calibrated probabilities, recent form, and recent results for
 * settling bets.  npx tsx ../scripts/build-data.ts <rawDir> <outDir>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { FdMatch, fair2, fair3, parseFd, played } from "../edgebook/src/lib/fd/csv";
import { DEFAULT_FIT, expected, fitRatings } from "../edgebook/src/lib/fd/model";
import { Params, estimate } from "../edgebook/src/lib/fd/calibrated";
import { LEAGUES, fixtureId, type LiveFile, type LiveFixture } from "../edgebook/src/lib/fd/live-file";
import PARAMS from "../edgebook/src/lib/fd/params.json";

const [raw = "../data/raw", out = "public/data"] = process.argv.slice(2);
const P = PARAMS as unknown as Params;

const results: FdMatch[] = [];
for (const s of readdirSync(raw).filter((x) => /^\d{4}$/.test(x)).sort())
  for (const f of readdirSync(`${raw}/${s}`))
    if (LEAGUES[f.replace(".csv", "")]) results.push(...parseFd(readFileSync(`${raw}/${s}/${f}`, "latin1")).filter(played));
results.sort((a, b) => a.t.localeCompare(b.t));
const fixtures = existsSync(`${raw}/fixtures.csv`)
  ? parseFd(readFileSync(`${raw}/fixtures.csv`, "latin1")).filter((m) => LEAGUES[m.div] && !played(m))
  : [];
const now = Date.now();

const tierFor = (div: string, at: number) => {
  const pts = new Map<string, number>();
  const ms = results.filter((m) => m.div === div && Date.parse(m.t) < at && Date.parse(m.t) > at - 300 * 86400_000);
  for (const m of ms) {
    pts.set(m.home, (pts.get(m.home) ?? 0) + (m.fh! > m.fa! ? 3 : m.fh === m.fa ? 1 : 0));
    pts.set(m.away, (pts.get(m.away) ?? 0) + (m.fa! > m.fh! ? 3 : m.fh === m.fa ? 1 : 0));
  }
  const order = [...pts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return (t: string) => {
    const i = order.indexOf(t);
    return i < 0 ? "avg" : i < order.length / 3 ? "strong" : i < (2 * order.length) / 3 ? "avg" : "weak";
  };
};

const out_: LiveFixture[] = [];
for (const m of fixtures) {
  const at = Date.parse(m.t);
  if (at < now - 3 * 3600_000) continue;
  const hist = results.filter((x) => x.div === m.div && Date.parse(x.t) < at);
  const recent = hist.slice(-380);
  const lg = recent.length ? recent.reduce((s, x) => s + x.fh! + x.fa!, 0) / recent.length : 2.7;
  const known = new Set<string>();
  hist.filter((x) => at - Date.parse(x.t) < 400 * 86400_000).forEach((x) => (known.add(x.home), known.add(x.away)));
  const R = fitRatings(hist, at, DEFAULT_FIT, "goals", known);
  const C = fitRatings(hist, at, { ...DEFAULT_FIT, newcomer: [1, 1] }, "corners");
  const e = expected(R, m.home, m.away, DEFAULT_FIT.newcomer);
  const ec = expected(C, m.home, m.away, [1, 1]);
  const f3 = fair3(m.avg);
  const f2 = fair2(m.avgOU);
  const probs = estimate(
    {
      model: e,
      fair: f3 ? { home: f3.h, draw: f3.d, away: f3.a, ...(f2 ? { "over2.5": f2.o } : {}) } : undefined,
      leagueGoals: lg,
      cornersModel: ec.home + ec.away,
      cornersLeague: C.muHome + C.muAway,
    },
    P
  );
  const tier = tierFor(m.div, at);
  const form = (team: string) =>
    hist
      .filter((x) => x.home === team || x.away === team)
      .slice(-10)
      .reverse()
      .map((x) => {
        const home = x.home === team;
        return [home ? x.fh! : x.fa!, home ? x.fa! : x.fh!, home ? "H" : "A", tier(home ? x.away : x.home)] as [number, number, "H" | "A", string];
      });
  const corners = (team: string) => {
    const l = hist.filter((x) => x.home === team || x.away === team).slice(-10);
    const f = l.reduce((s, x) => s + (x.home === team ? x.hc ?? 0 : x.ac ?? 0), 0) / (l.length || 1);
    const a = l.reduce((s, x) => s + (x.home === team ? x.ac ?? 0 : x.hc ?? 0), 0) / (l.length || 1);
    return [+f.toFixed(1), +a.toFixed(1)] as [number, number];
  };
  const price = (o3?: { h: number; d: number; a: number }, o2?: { o: number; u: number }) => ({
    ...(o3 ? { home: o3.h, draw: o3.d, away: o3.a } : {}),
    ...(o2 ? { "over2.5": o2.o, "under2.5": o2.u } : {}),
  });
  out_.push({
    id: fixtureId(m.div, m.t, m.home, m.away),
    div: m.div,
    t: m.t,
    home: m.home,
    away: m.away,
    probs: Object.fromEntries(Object.entries(probs).map(([k, v]) => [k, +v.toFixed(4)])),
    odds: price(m.b365, m.b365OU),
    avg: price(m.avg, m.avgOU),
    best: price(m.max, m.maxOU),
    xg: [+e.home.toFixed(2), +e.away.toFixed(2)],
    cornersMean: +(C.muHome + C.muAway).toFixed(1),
    form: [form(m.home), form(m.away)],
    corners: [corners(m.home), corners(m.away)],
  });
}

const since = now - 45 * 86400_000;
const settled = results
  .filter((m) => Date.parse(m.t) > since)
  .map((m) => [fixtureId(m.div, m.t, m.home, m.away), m.fh!, m.fa!, m.hh ?? -1, m.ha ?? -1, m.hc !== undefined && m.ac !== undefined ? m.hc + m.ac : -1] as const);

const file: LiveFile = {
  generatedAt: new Date().toISOString(),
  source: "football-data.co.uk",
  fixtures: out_,
  results: settled as unknown as LiveFile["results"],
  backtest: JSON.parse(readFileSync(new URL("../edgebook/src/lib/fd/backtest-summary.json", import.meta.url), "utf8")),
};
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/live.json`, JSON.stringify(file));
console.log(`live.json: ${out_.length} fixtures, ${settled.length} recent results`);
