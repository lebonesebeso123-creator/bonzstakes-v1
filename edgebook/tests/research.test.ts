import { test } from "node:test";
import assert from "node:assert/strict";
import { probsFromRates, SELECTIONS } from "../src/lib/research/markets";
import { DemoProvider, demoForceResult } from "../src/lib/research/data";
import {
  analyseFixture,
  buildSlip,
  groupByLeague,
  learnFactor,
  leagueGoalAverages,
  rangeFor,
  settles,
  valuePicks,
} from "../src/lib/research/engine";

const ALL = ["1x2", "dc", "btts", "goals", "corners", "htBtts", "htGoals", "combo"] as const;

test("complementary markets sum to 1", () => {
  const p = probsFromRates(1.6, 1.1, 10);
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(p.home + p.draw + p.away, 1);
  near(p.bttsYes + p.bttsNo, 1);
  near(p["over2.5"] + p["under2.5"], 1);
  near(p["cOver9.5"] + p["cUnder9.5"], 1);
  near(p.htBttsYes + p.htBttsNo, 1);
  assert.ok(p.homeBtts < p.home && p.homeBtts < p.bttsYes, "combo is rarer than either part");
  for (const s of SELECTIONS) assert.ok(p[s.key] > 0 && p[s.key] < 1, s.key);
});

test("selections settle correctly", () => {
  const r = { home: 2, away: 1, htHome: 0, htAway: 1, corners: 11 };
  assert.equal(settles("home", r), true);
  assert.equal(settles("bttsYes", r), true);
  assert.equal(settles("over2.5", r), true);
  assert.equal(settles("htBttsYes", r), false);
  assert.equal(settles("htOver0.5", r), true);
  assert.equal(settles("cOver10.5", r), true);
  assert.equal(settles("homeBtts", r), true);
  assert.equal(settles("awayO15", r), false);
});

test("weekend range covers Saturday and Sunday", () => {
  const sat = new Date(2026, 10, 21, 10, 0);
  const { to } = rangeFor("weekend", sat);
  assert.equal(to.getDate(), 23);
  const wed = new Date(2026, 10, 18, 9, 0);
  const w = rangeFor("weekend", wed);
  assert.equal(w.from.getDay(), 5);
  assert.equal(w.to.getDate(), 23);
});

test("demo data is repeatable and leagues are ordered biggest first", async () => {
  const from = new Date(2026, 10, 21);
  const to = new Date(2026, 10, 23);
  const a = await DemoProvider.getFixtures(from, to);
  const b = await DemoProvider.getFixtures(from, to);
  assert.ok(a.length > 30);
  assert.deepEqual(a.map((f) => f.id + f.odds.home), b.map((f) => f.id + f.odds.home));
  const avg = leagueGoalAverages(a);
  const ms = a.map((f) => analyseFixture(f, [...ALL], undefined, avg[f.league.id])!);
  const leagues = groupByLeague(ms);
  for (let i = 1; i < leagues.length; i++) assert.ok(leagues[i - 1].tier <= leagues[i].tier);
  assert.equal(demoForceResult(a[0].id)?.home, demoForceResult(a[0].id)?.home);
});

test("results only arrive after the match", async () => {
  const fx = (await DemoProvider.getFixtures(new Date(2026, 10, 21), new Date(2026, 10, 23)))[0];
  const k = new Date(fx.kickoff).getTime();
  assert.equal(await DemoProvider.getResult(fx.id, new Date(k - 60_000)), null);
  assert.ok(await DemoProvider.getResult(fx.id, new Date(k + 3 * 3600_000)));
});

test("slip builder reaches the target with one pick per match", async () => {
  const fixtures = await DemoProvider.getFixtures(new Date(2026, 10, 21), new Date(2026, 10, 23));
  const avg = leagueGoalAverages(fixtures);
  const ms = fixtures.map((f) => analyseFixture(f, [...ALL], undefined, avg[f.league.id])!);
  for (const t of [2, 5, 10]) {
    const s = buildSlip(ms, t);
    assert.ok(s.reached, `target ${t}`);
    assert.ok(s.totalOdds >= t);
    assert.equal(new Set(s.legs.map((l) => l.fixtureId)).size, s.legs.length);
    assert.ok(Math.abs(s.chance - s.legs.reduce((a, l) => a * l.prob, 1)) < 1e-12);
  }
  // edges stay realistic, not fantasy
  for (const p of valuePicks(ms)) assert.ok(p.edge < 0.35, `${p.label} edge ${p.edge}`);
});

test("learning nudges estimates toward what actually happened, within limits", () => {
  assert.equal(learnFactor(undefined, "bttsYes"), 1);
  const hot = learnFactor({ bttsYes: { n: 20, wins: 16, expected: 11 } }, "bttsYes");
  const cold = learnFactor({ bttsYes: { n: 20, wins: 6, expected: 11 } }, "bttsYes");
  assert.ok(hot > 1 && hot <= 1.15);
  assert.ok(cold < 1 && cold >= 0.85);
  assert.equal(learnFactor({ bttsYes: { n: 500, wins: 500, expected: 100 } }, "bttsYes"), 1.15);
});
