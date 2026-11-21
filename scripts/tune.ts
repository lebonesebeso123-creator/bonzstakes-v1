/**
 * Tunes the calibrated estimator on 2022/23–2023/24 and reports on 2024/25 onward (never seen while tuning).
 *   npx tsx scripts/tune.ts rows.json [params-out.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Row } from "./backtest";
import { ll } from "./backtest";
import { appNow, calibration, picks, quality, PRICED, ALL_KEYS, Prob } from "./report";
import { DEFAULT_PARAMS, Params, estimate, fitCalibration, impliedGoals } from "../edgebook/src/lib/fd/calibrated";
import { SELECTION_BY_KEY } from "../edgebook/src/lib/research/markets";

const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
const fairOf = (r: Row) => r.mkt;
// cache the market-implied goals (independent of every tuned parameter)
const implied = new Map<Row, { home: number; away: number } | undefined>();
for (const r of rows) {
  const f = fairOf(r);
  implied.set(r, f?.home !== undefined && f.away !== undefined ? impliedGoals(f.home, f.away, f["over2.5"], r.lg) : undefined);
}
const est = (r: Row, P: Params) =>
  estimate({ model: r.lam, fair: fairOf(r), leagueGoals: r.lg, cornersModel: r.cm, cornersLeague: r.cl, implied: implied.get(r) }, P);

const train = rows.filter((r) => r.season < "2425");
const test = rows.filter((r) => r.season >= "2425");
const loss = (set: Row[], P: Params, keys: string[]) => {
  let s = 0, n = 0;
  for (const r of set) {
    const e = est(r, P);
    for (const k of keys) {
      s += ll(e[k], r.y[k]);
      n++;
    }
  }
  return s / n;
};
const best = <T,>(vals: T[], f: (v: T) => number) => vals.map((v) => [v, f(v)] as const).sort((a, b) => a[1] - b[1])[0];

let P: Params = { ...DEFAULT_PARAMS, calib: {} };
const GOALS = ["bttsYes", "over1.5", "over3.5", "dc1X", "dcX2", "dc12", "homeBtts", "awayBtts", "homeO15", "awayO15", "bttsO25"];
const HT = ["htBttsYes", "htOver0.5", "htOver1.5"];
const CORNERS = ["cOver8.5", "cOver9.5", "cOver10.5"];
const [wp] = best([0, 0.05, 0.1, 0.15, 0.25], (v) => loss(train, { ...P, wPriced: v }, ["home", "draw", "away", "over2.5"]));
P = { ...P, wPriced: wp };
const [wg] = best([0, 0.1, 0.2, 0.3, 0.45, 0.6], (v) => loss(train, { ...P, wGoals: v }, GOALS));
P = { ...P, wGoals: wg };
const [hs] = best([0.38, 0.4, 0.42, 0.44, 0.46], (v) => loss(train, { ...P, htShare: v }, HT));
P = { ...P, htShare: hs };
let bc = { s: 0.5, r: 12, l: Infinity };
for (const s of [0, 0.25, 0.5, 0.75, 1]) for (const r of [5, 8, 12, 20, 40]) {
  const l = loss(train, { ...P, cornerShrink: s, cornerR: r }, CORNERS);
  if (l < bc.l) bc = { s, r, l };
}
P = { ...P, cornerShrink: bc.s, cornerR: bc.r };
// per-market recalibration on the training seasons
const keys = ALL_KEYS.filter((k) => !["under1.5", "under2.5", "under3.5", "bttsNo", "htBttsNo", "htUnder0.5", "cUnder8.5", "cUnder9.5", "cUnder10.5"].includes(k));
for (const k of keys) {
  const ps: number[] = [], ys: number[] = [];
  for (const r of train) {
    ps.push(est(r, P)[k]);
    ys.push(r.y[k]);
  }
  P.calib[k] = fitCalibration(ps, ys).map((v) => +v.toFixed(4)) as [number, number];
}
console.log("tuned on 2022/23–2023/24:", JSON.stringify({ ...P, calib: `${Object.keys(P.calib).length} markets` }));
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(P, null, 1));

const cache = new Map<Row, Record<string, number>>();
const v2: Prob = (r, k) => {
  if (!cache.has(r)) cache.set(r, est(r, P));
  return cache.get(r)![k];
};

console.log("\n== Log loss on 2024/25 onward (lower is better)");
const q = quality(test, [...PRICED, "bttsYes", "over1.5", "over3.5", "dc1X", "cOver9.5", "htBttsYes", "htOver0.5"], { before: appNow, after: v2, market: (r, k) => fairOf(r)?.[k], base: (r, k) => r.base[k] });
console.table(q);
console.log("\n== Calibration after (all markets, test)");
console.table(calibration(test, ALL_KEYS, v2));

const show = (name: string, x: ReturnType<typeof picks>) =>
  console.log(`${name}: ${x.picks} picks, win ${(x.winRatio * 100).toFixed(1)}% vs expected ${(x.expected * 100).toFixed(1)}%, ${x.pricedBets} priced, ROI ${x.roi === null ? "–" : (x.roi * 100).toFixed(1) + "%"}, CLV ${x.clv === null ? "–" : (x.clv * 100).toFixed(1) + "%"}`);
const summary = {
  testedOn: test.length,
  seasons: "2024/25 to now",
  trainedOn: "2022/23–2023/24",
  topPicks: picks(test, v2, { perDay: 10, minProb: 0.55, minOdds: 1.25 }),
  valueBest: picks(test, v2, { perDay: 6, minProb: 0.3, minOdds: 1.3, maxOdds: 4, valueEdge: 0.04, price: "best", keys: ["home", "draw", "away", "over2.5", "under2.5"] }),
  valueSoft: picks(test, v2, { perDay: 6, minProb: 0.3, minOdds: 1.3, maxOdds: 4, valueEdge: 0.04, price: "soft", keys: ["home", "draw", "away", "over2.5", "under2.5"] }),
};
const slim = (x: ReturnType<typeof picks>) => ({ picks: x.picks, winRatio: x.winRatio, expected: x.expected, roi: x.roi, clv: x.clv });
if (process.argv[4])
  writeFileSync(process.argv[4], JSON.stringify({ testedOn: summary.testedOn, seasons: summary.seasons, trainedOn: summary.trainedOn, topPicks: slim(summary.topPicks), topByMarket: summary.topPicks.byMarket, valueBest: slim(summary.valueBest), valueSoft: slim(summary.valueSoft) }, null, 1));
console.log("\n== Daily top 10 most likely (test)");
show("before", picks(test, appNow, { perDay: 10, minProb: 0.55, minOdds: 1.25 }));
const after = picks(test, v2, { perDay: 10, minProb: 0.55, minOdds: 1.25 });
show("after ", after);
console.log(JSON.stringify(after.byMarket));
console.log("\n== Value picks at Bet365 prices (test)");
show("before        ", picks(test, appNow, { perDay: 5, minProb: 0.4, minOdds: 1.2, maxOdds: 4, valueEdge: 0.02 }));
for (const e of [0.02, 0.04, 0.06, 0.08]) show(`after edge≥${e}`, picks(test, v2, { perDay: 5, minProb: 0.35, minOdds: 1.2, maxOdds: 4, valueEdge: e, keys: ["home", "draw", "away", "over2.5", "under2.5"] }));
console.log("\n== Same, at the best price on the market (line shopping)");
for (const e of [0.02, 0.04]) show(`best edge≥${e}`, picks(test, v2, { perDay: 5, minProb: 0.35, minOdds: 1.2, maxOdds: 4, valueEdge: e, price: "best", keys: ["home", "draw", "away", "over2.5", "under2.5"] }));
