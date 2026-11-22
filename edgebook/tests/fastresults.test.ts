import { test } from "node:test";
import assert from "node:assert/strict";
import { FileProvider } from "../src/lib/research/file-provider";
import { DemoProvider } from "../src/lib/research/data";
import { fixtureId } from "../src/lib/fd/live-file";

const id = fixtureId("D1", "2026-11-21T15:30:00Z", "Ein Frankfurt", "Hoffenheim");
const file = {
  generatedAt: "2026-11-22T06:00:00Z", source: "test", fixtures: [], results: [],
  fast: [
    ["D1", "2026-11-21T15:30Z", "Eintracht Frankfurt", "TSG Hoffenheim", "FT", 2, 1, 1, 0, 11],
    ["D1", "2026-11-21T15:30Z", "Bayer Leverkusen", "SC Paderborn", "FT", 3, 0, 2, 0, -1],
    ["E0", "2026-11-21T17:30Z", "Nottingham Forest", "Everton", "VOID", -1, -1, -1, -1, -1],
  ],
  backtest: {},
};
globalThis.fetch = (async () => new Response(JSON.stringify(file))) as typeof fetch;

test("fast scores are matched by league, kick-off and team names", async () => {
  const r = await FileProvider.getResult(id, new Date("2026-11-22T08:00:00Z"), { home: "Eintracht Frankfurt", away: "Hoffenheim", kickoff: "2026-11-21T15:30:00.000Z" });
  assert.ok(r && r !== "void");
  assert.equal(r.home, 2);
  assert.equal(r.corners, 11);
  assert.deepEqual(r.missing, []);
  const lev = await FileProvider.getResult(fixtureId("D1", "2026-11-21T15:30:00Z", "Leverkusen", "Paderborn"), new Date(), { home: "Bayer Leverkusen", away: "Paderborn", kickoff: "2026-11-21T15:30:00Z" });
  assert.ok(lev && lev !== "void" && lev.missing?.includes("corners"), "missing corners → corner legs void");
  const wrongTime = await FileProvider.getResult(id, new Date(), { home: "Eintracht Frankfurt", away: "Hoffenheim", kickoff: "2026-11-22T19:30:00Z" });
  assert.equal(wrongTime, null, "a different kick-off is not this match");
});

test("postponed matches void only after 48 hours", async () => {
  const pid = fixtureId("E0", "2026-11-21T17:30:00Z", "Nott'm Forest", "Everton");
  const hint = { home: "Nottingham Forest", away: "Everton", kickoff: "2026-11-21T17:30:00Z" };
  assert.equal(await FileProvider.getResult(pid, new Date("2026-11-22T08:00:00Z"), hint), null);
  assert.equal(await FileProvider.getResult(pid, new Date("2026-11-24T08:00:00Z"), hint), "void");
});

test("bets on removed demo leagues are voided", async () => {
  assert.equal(await DemoProvider.getResult("bpl|2026-11-21|0-1", new Date("2026-11-22")), "void");
});
