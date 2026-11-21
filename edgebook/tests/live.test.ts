import { test } from "node:test";
import assert from "node:assert/strict";
import { createLiveProvider, liteResult, matchEvent, nameSimilarity, oddsFromEvent } from "../src/lib/research/live";
import { fairFromOdds } from "../src/lib/research/markets";
import { analyseFixture, learningFrom, settleOutcome } from "../src/lib/research/engine";
import { mergeStates } from "../src/lib/store";
import { AppState, Bet } from "../src/lib/types";

// minimal browser shims
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

const day = (d: number, h = 15) => new Date(Date.UTC(2026, 10, d, h, 0)).toISOString();
const team = (id: number, name: string, shortName: string) => ({ id, name, shortName });
const ARS = team(57, "Arsenal FC", "Arsenal");
const MUN = team(66, "Manchester United FC", "Man United");
const BHA = team(397, "Brighton & Hove Albion FC", "Brighton Hove");
const WOL = team(76, "Wolverhampton Wanderers FC", "Wolverhampton");
const fin = (id: number, d: number, h: typeof ARS, a: typeof ARS, ft: [number, number], ht: [number, number]) => ({
  id, utcDate: day(d), status: "FINISHED", homeTeam: h, awayTeam: a,
  score: { fullTime: { home: ft[0], away: ft[1] }, halfTime: { home: ht[0], away: ht[1] } },
});
const PL = {
  matches: [
    fin(1, 1, ARS, BHA, [2, 0], [1, 0]),
    fin(2, 2, MUN, WOL, [1, 1], [0, 1]),
    fin(3, 8, BHA, MUN, [3, 2], [1, 1]),
    fin(4, 9, WOL, ARS, [0, 2], [0, 0]),
    fin(5, 15, ARS, MUN, [1, 0], [0, 0]),
    fin(6, 15, BHA, WOL, [2, 2], [1, 2]),
    { id: 7, utcDate: day(22, 16), status: "TIMED", homeTeam: ARS, awayTeam: WOL, score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } } },
    { id: 8, utcDate: day(22, 14), status: "POSTPONED", homeTeam: MUN, awayTeam: BHA, score: { fullTime: { home: null, away: null } } },
  ],
};
const EVENTS = [
  {
    id: "e1", commence_time: day(22, 16), home_team: "Arsenal", away_team: "Wolverhampton Wanderers",
    bookmakers: [
      { key: "a", last_update: day(21, 9), markets: [
        { key: "h2h", outcomes: [{ name: "Arsenal", price: 1.4 }, { name: "Wolverhampton Wanderers", price: 8 }, { name: "Draw", price: 5 }] },
        { key: "totals", outcomes: [{ name: "Over", price: 1.8, point: 2.5 }, { name: "Under", price: 2.0, point: 2.5 }] },
      ] },
      { key: "b", last_update: day(21, 10), markets: [
        { key: "h2h", outcomes: [{ name: "Arsenal", price: 1.44 }, { name: "Wolverhampton Wanderers", price: 7.5 }, { name: "Draw", price: 4.8 }] },
      ] },
    ],
  },
];

test("team names match across APIs", () => {
  assert.ok(nameSimilarity("Brighton & Hove Albion FC", "Brighton and Hove Albion") > 0.9);
  assert.ok(nameSimilarity("Wolverhampton", "Wolverhampton Wanderers") >= 0.5);
  assert.ok(nameSimilarity("Arsenal", "Chelsea") === 0);
  assert.equal(matchEvent("Arsenal", "Wolverhampton", day(22, 16), EVENTS as never)?.id, "e1");
  assert.equal(matchEvent("Arsenal", "Wolverhampton", day(23, 20), EVENTS as never), null, "time must be close");
});

test("median odds across bookmakers, margin removed", () => {
  const { odds, updated } = oddsFromEvent(EVENTS[0] as never);
  assert.equal(odds.home, 1.42);
  assert.equal(odds["over2.5"], 1.8);
  assert.equal(updated, day(21, 10));
  const f = fairFromOdds(odds);
  assert.ok(Math.abs(f.home + f.draw + f.away - 1) < 1e-9);
  assert.ok(Math.abs(f.dc1X - (f.home + f.draw)) < 1e-12);
  assert.ok(f.home < 1 / odds.home, "margin removed");
});

test("live provider builds fixtures with form and prices", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: string) => {
    if (String(u).includes("/fd/competitions/PL/")) return new Response(JSON.stringify(PL));
    if (String(u).includes("/fd/")) return new Response(JSON.stringify({ matches: [] }));
    if (String(u).includes("/odds/soccer_epl")) return new Response(JSON.stringify(EVENTS));
    return new Response("[]");
  }) as typeof fetch;
  try {
    mem.clear();
    const p = createLiveProvider("https://proxy.example/");
    const fx = await p.getFixtures(new Date(day(21, 0)), new Date(day(24, 0)));
    assert.equal(fx.length, 1, "postponed match is skipped");
    const f = fx[0];
    assert.equal(f.id, "fd:PL:7");
    assert.equal(f.home, "Arsenal");
    assert.equal(f.homeForm.length, 3);
    assert.deepEqual(f.homeForm[0], { gf: "1", ga: "0", venue: "H", opp: f.homeForm[0].opp });
    assert.equal(f.hasCorners, false);
    assert.ok(f.odds.home > 1);
    const m = analyseFixture(f, ["1x2", "btts", "corners"], undefined, 2.7)!;
    assert.ok(!m.options.some((o) => o.group === "corners"), "no corners without data");
    assert.ok(m.options.find((o) => o.key === "home")!.priced);
    assert.equal(m.options.find((o) => o.key === "bttsYes")!.priced, false);
    assert.equal(m.options.find((o) => o.key === "bttsYes")!.edge, null, "no value without a real price");
    const r = await p.getResult("fd:PL:5");
    assert.ok(r && r !== "void" && r.home === 1 && r.htHome === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("postponed/cancelled matches void, missing data voids the leg", () => {
  const base = { id: 1, t: day(1), h: 1, a: 2, hn: "A", an: "B" };
  assert.equal(liteResult({ ...base, s: "CANCELLED" }), "void");
  assert.equal(liteResult({ ...base, s: "POSTPONED" }, new Date(day(1, 20))), null);
  assert.equal(liteResult({ ...base, s: "POSTPONED" }, new Date(day(4))), "void");
  const r = liteResult({ ...base, s: "FINISHED", ft: [2, 1] })!;
  assert.notEqual(r, "void");
  if (r !== "void") {
    assert.equal(settleOutcome("home", r), "won");
    assert.equal(settleOutcome("cOver9.5", r), "void");
    assert.equal(settleOutcome("htBttsYes", r), "void", "no half-time score → void");
  }
});

test("learning counts only settled legs after a reset", () => {
  const leg = (key: string, status: string, prob = 0.6) => ({ key, status, prob });
  const bets = [
    { placedAt: "2026-11-01", legs: [leg("bttsYes", "won"), leg("home", "void")] },
    { placedAt: "2026-11-10", legs: [leg("bttsYes", "lost"), leg("home", "won")] },
  ];
  const all = learningFrom(bets);
  assert.deepEqual(all.bttsYes, { n: 2, wins: 1, expected: 1.2 });
  assert.equal(all.home.n, 1);
  assert.equal(learningFrom(bets, "2026-11-05").bttsYes.n, 1);
});

test("sync merge keeps both devices' data and respects deletions", () => {
  const bet = (id: string, status: Bet["status"], settledAt?: string): Bet => ({
    id, sport: "football", matchLabel: id, market: "m", selection: "s", odds: 2, stake: 10, status, placedAt: "2026-11-0" + id.length, settledAt,
  });
  const base: AppState = { v: 2, ackAt: "x", startingBankroll: 1000, adjustments: [], bets: [], analyses: [], notes: [], settings: { currency: "BWP", kellyFraction: 0.25, maxStakePct: 3, evThreshold: 0.05 } };
  const local: AppState = { ...base, bets: [bet("a", "open"), bet("b", "open")], deleted: ["c"], updatedAt: "2026-11-21T10:00", sync: { token: "secret" } };
  const remote: Partial<AppState> = { ...base, bets: [bet("a", "won", "2026-11-20"), bet("c", "open"), bet("dd", "lost", "2026-11-19")], deleted: ["b"], updatedAt: "2026-11-21T09:00", settings: { ...base.settings, currency: "USD" } };
  const m = mergeStates(local, remote);
  assert.deepEqual(m.bets.map((b) => b.id).sort(), ["a", "dd"]);
  assert.equal(m.bets.find((b) => b.id === "a")!.status, "won", "settled copy wins");
  assert.equal(m.settings.currency, "BWP", "newer settings win");
  assert.equal(m.sync?.token, "secret", "token stays local");
});
