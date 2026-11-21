import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFd, ukToUtc, fair3 } from "../src/lib/fd/csv";
import { estimate, impliedGoals, DEFAULT_PARAMS, fitCalibration } from "../src/lib/fd/calibrated";
import { fitRatings, expected } from "../src/lib/fd/model";
import { analyseFixture } from "../src/lib/research/engine";
import { toFixture } from "../src/lib/research/file-provider";
import { fixtureId } from "../src/lib/fd/live-file";

test("UK kick-off times convert to UTC across BST", () => {
  assert.equal(ukToUtc("15/08/2025", "20:00"), "2025-08-15T19:00:00.000Z");
  assert.equal(ukToUtc("22/11/2026", "15:00"), "2026-11-22T15:00:00.000Z");
  assert.equal(ukToUtc("01/04/26", "12:30"), "2026-04-01T11:30:00.000Z");
});

test("CSV rows parse with odds and stats", () => {
  const csv = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG,HC,AC,B365H,B365D,B365A,AvgH,AvgD,AvgA,Avg>2.5,Avg<2.5\nE0,15/08/2025,20:00,Liverpool,Bournemouth,4,2,1,0,6,7,1.3,6,8.5,1.31,5.96,8.31,1.35,3.13\n";
  const [m] = parseFd(csv);
  assert.equal(m.home, "Liverpool");
  assert.equal(m.fh, 4);
  assert.equal(m.hc, 6);
  assert.deepEqual(m.avg, { h: 1.31, d: 5.96, a: 8.31 });
  const f = fair3(m.avg)!;
  assert.ok(Math.abs(f.h + f.d + f.a - 1) < 1e-9);
});

test("market-implied goals reproduce the prices", () => {
  const g = impliedGoals(0.55, 0.2, 0.6);
  const p = estimate({ model: { home: 1.4, away: 1.1 }, fair: { home: 0.55, draw: 0.25, away: 0.2, "over2.5": 0.6 }, leagueGoals: 2.7, cornersModel: 10, cornersLeague: 10, implied: g }, { ...DEFAULT_PARAMS, wPriced: 0 });
  assert.ok(Math.abs(p.home - 0.55) < 1e-9 && Math.abs(p["over2.5"] - 0.6) < 1e-9);
  assert.ok(p.bttsYes > 0.3 && p.bttsYes < 0.7);
  assert.ok(Math.abs(p["cOver9.5"] + p["cUnder9.5"] - 1) < 1e-9);
});

test("calibration fit is close to identity for calibrated data", () => {
  const ps: number[] = [], ys: number[] = [];
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4000; i++) {
    const p = 0.1 + 0.8 * r();
    ps.push(p);
    ys.push(r() < p ? 1 : 0);
  }
  const [a, b] = fitCalibration(ps, ys);
  assert.ok(Math.abs(a - 1) < 0.15 && Math.abs(b) < 0.15, `${a} ${b}`);
});

test("ratings only use matches before the date and favour the stronger side", () => {
  const ms = Array.from({ length: 20 }, (_, i) => ({ div: "E0", t: `2026-0${1 + (i % 8)}-1${i % 9}T15:00:00Z`, home: i % 2 ? "A" : "B", away: i % 2 ? "B" : "A", fh: i % 2 ? 3 : 0, fa: i % 2 ? 0 : 2 }));
  const R = fitRatings(ms, Date.parse("2026-12-01"));
  const e = expected(R, "A", "B");
  assert.ok(e.home > e.away);
  const early = fitRatings(ms, Date.parse("2025-12-01"));
  assert.equal(early.attack.size, 0, "nothing before the date");
});

test("real fixtures use the calibrated probabilities and real prices", () => {
  const live = {
    id: fixtureId("E0", "2026-11-22T15:00:00Z", "Arsenal", "Chelsea"), div: "E0", t: "2026-11-22T15:00:00Z", home: "Arsenal", away: "Chelsea",
    probs: { home: 0.55, draw: 0.25, away: 0.2, dc1X: 0.8, dcX2: 0.45, dc12: 0.75, bttsYes: 0.52, bttsNo: 0.48, "over2.5": 0.56, "under2.5": 0.44, "cOver9.5": 0.5, "cUnder9.5": 0.5 },
    odds: { home: 1.75, draw: 3.8, away: 4.6, "over2.5": 1.7, "under2.5": 2.1 }, avg: {}, best: { home: 1.85 },
    xg: [1.7, 1.1] as [number, number], cornersMean: 10.1,
    form: [[[2, 0, "H", "avg"], [1, 1, "A", "strong"]], [[0, 1, "A", "weak"]]] as never,
    corners: [[6, 4], [5, 5]] as [[number, number], [number, number]],
  };
  const f = toFixture(live, "2026-11-21T12:00:00Z");
  assert.equal(f.league.name, "Premier League");
  const m = analyseFixture(f, ["1x2", "btts", "corners"], undefined, 2.7)!;
  const home = m.options.find((o) => o.key === "home")!;
  assert.equal(home.prob, 0.55);
  assert.ok(home.priced && Math.abs(home.edge! - (0.55 * 1.75 - 1)) < 1e-9);
  assert.equal(m.options.find((o) => o.key === "bttsYes")!.priced, false);
  assert.equal(m.xgHome, 1.7);
});
