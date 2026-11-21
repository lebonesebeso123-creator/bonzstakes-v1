import { test } from "node:test";
import assert from "node:assert/strict";
import { reasonsFor } from "../src/lib/research/reasons";
import { learningFrom, localDay } from "../src/lib/research/engine";
import { Fixture } from "../src/lib/research/data";

const fx = (home: [number, number, "H" | "A"][], away: [number, number, "H" | "A"][]): Fixture => ({
  id: "x", league: { id: "l", name: "L", country: "C", tier: 1 }, kickoff: "2026-11-22T15:00:00Z",
  home: "Liverpool", away: "Everton",
  homeForm: home.map(([gf, ga, venue]) => ({ gf: String(gf), ga: String(ga), venue, opp: "avg" })),
  awayForm: away.map(([gf, ga, venue]) => ({ gf: String(gf), ga: String(ga), venue, opp: "avg" })),
  homeCorners: { for: 6.1, against: 4 }, awayCorners: { for: 4.2, against: 5.5 }, odds: {},
});

const f = fx(
  [[2, 0, "H"], [3, 1, "H"], [1, 1, "A"], [2, 1, "H"], [0, 1, "A"], [4, 0, "H"], [2, 2, "A"], [1, 0, "H"]],
  [[0, 2, "A"], [1, 1, "H"], [0, 3, "A"], [1, 2, "A"], [2, 0, "H"], [0, 1, "A"], [1, 1, "H"], [0, 2, "A"]]
);

test("reasons are plain facts from the form", () => {
  const home = reasonsFor("home", f);
  assert.ok(home.some((r) => r === "Liverpool won 5 of their last 5 at home"), home.join(" | "));
  assert.ok(home.some((r) => r === "Everton lost 5 of their last 5 away"), home.join(" | "));
  const o25 = reasonsFor("over2.5", f);
  assert.match(o25[0], /^\d of Liverpool's last 5 at home and \d of Everton's last 5 away went over 2.5$/);
  assert.match(o25[1], /^Their games average \d\.\d goals$/);
  assert.match(reasonsFor("cOver9.5", f)[0], /average 9\.9 corners/);
  assert.ok(reasonsFor("bttsNo", f).length >= 1);
  assert.deepEqual(reasonsFor("home", fx([[1, 0, "H"]], [[0, 1, "A"]])), [], "too little data says nothing");
});

test("weak evidence is left out rather than shown", () => {
  // Liverpool never won: no 'won 0 of their last 5' line
  const g = fx(Array(6).fill([0, 1, "H"]), Array(6).fill([0, 1, "A"]));
  assert.ok(!reasonsFor("home", g).some((r) => r.startsWith("Liverpool won")));
});

test("learning counts daily picks and slips once per selection", () => {
  const tracked = [
    { fixtureId: "a", key: "home", prob: 0.7, status: "won", recordedAt: "2026-11-21" },
    { fixtureId: "b", key: "home", prob: 0.6, status: "lost", recordedAt: "2026-11-21" },
    { fixtureId: "c", key: "home", prob: 0.6, status: "open", recordedAt: "2026-11-21" },
  ];
  const bets = [{ placedAt: "2026-11-21", legs: [{ fixtureId: "a", key: "home", prob: 0.7, status: "won" }] }];
  const L = learningFrom(bets, undefined, tracked);
  assert.equal(L.home.n, 2, "same match + selection counted once, open ignored");
  assert.equal(L.home.wins, 1);
});

test("local day keys", () => {
  assert.equal(localDay(new Date(2026, 10, 21, 23, 59)), "2026-11-21");
  assert.equal(localDay(new Date(2026, 10, 22, 0, 1)), "2026-11-22");
});
