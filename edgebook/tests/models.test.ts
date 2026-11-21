import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FOOTBALL, parseResults, predictFootball, scoreMatrix } from "../src/lib/models/football";
import { expectedValue, fairProbs, kellyFraction, parseOdds, suggestStake } from "../src/lib/odds";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("score matrix sums to 1", () => {
  const m = scoreMatrix(1.6, 1.1);
  near(m.flat().reduce((a, b) => a + b, 0), 1);
});

test("football 1X2 sums to 1 and ranges bracket the estimate", () => {
  const m = predictFootball({
    ...DEFAULT_FOOTBALL,
    homeForm: parseResults("2-1 H, 3-0 A, 1-1 H, 2-0 H"),
    awayForm: parseResults("1-2 A, 0-0 H, 2-2 A, 1-0 H"),
  })!;
  near(m.probs.home + m.probs.draw + m.probs.away, 1);
  for (const k of ["home", "draw", "away", "over2.5", "bttsYes"]) {
    assert.ok(m.ranges[k][0] <= m.probs[k] + 1e-9 && m.probs[k] <= m.ranges[k][1] + 1e-9, k);
  }
});

test("stronger home form raises home win probability", () => {
  const weak = parseResults("0-1, 0-0, 1-2, 0-2");
  const strong = parseResults("3-0, 2-0, 4-1, 2-1");
  const base = { ...DEFAULT_FOOTBALL, awayForm: parseResults("1-1, 1-0, 0-1, 2-2") };
  const a = predictFootball({ ...base, homeForm: weak })!;
  const b = predictFootball({ ...base, homeForm: strong })!;
  assert.ok(b.probs.home > a.probs.home);
});

test("neutral venue removes home advantage", () => {
  const form = parseResults("1-1 N, 2-1 N, 0-0 N");
  const i = { ...DEFAULT_FOOTBALL, homeForm: form, awayForm: form };
  const n = predictFootball({ ...i, neutral: true })!;
  near(n.lambdaHome, n.lambdaAway, 1e-9);
});

test("incomplete rows are ignored", () => {
  assert.equal(
    predictFootball({ ...DEFAULT_FOOTBALL, homeForm: [{ gf: "", ga: "", venue: "H", opp: "avg" }], awayForm: [] }),
    null
  );
});

test("odds parsing", () => {
  assert.equal(parseOdds("2.5"), 2.5);
  assert.equal(parseOdds("2,5"), 2.5);
  assert.equal(parseOdds("5/2"), 3.5);
  assert.equal(parseOdds("1.00"), null);
  assert.equal(parseOdds("abc"), null);
});

test("margin removal", () => {
  const r = fairProbs([2.0, 3.5, 4.0])!;
  near(r.fair.reduce((a, b) => a + b, 0), 1);
  assert.ok(r.margin > 0);
  assert.equal(fairProbs([2.0, null]), null);
});

test("EV and Kelly", () => {
  near(expectedValue(0.5, 2.1), 0.05);
  near(kellyFraction(0.5, 2.1), 0.05 / 1.1);
  assert.equal(kellyFraction(0.4, 2.0), 0);
  assert.equal(suggestStake(1000, 0.6, 2.0, 0.25, 3), 30); // capped at 3%
});
