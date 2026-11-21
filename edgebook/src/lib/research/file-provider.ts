/**
 * Real fixtures, odds, form and results from football-data.co.uk, refreshed every 6 hours by the
 * site's GitHub Action and served as a static file next to the app. No keys, no servers.
 */
import { LEAGUES, LiveFile, displayName } from "../fd/live-file";
import { OppTier } from "../types";
import { DataProvider, Fixture, ResultOrVoid } from "./data";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
let cache: { at: number; file: LiveFile } | null = null;
let inflight: Promise<LiveFile | null> | null = null;

export async function loadLiveFile(force = false): Promise<LiveFile | null> {
  if (!force && cache && Date.now() - cache.at < 10 * 60_000) return cache.file;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch(`${BASE}/data/live.json`, { cache: "no-cache" });
      if (!r.ok) return null;
      const file = (await r.json()) as LiveFile;
      cache = { at: Date.now(), file };
      return file;
    } catch {
      return cache?.file ?? null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function toFixture(f: LiveFile["fixtures"][number], generatedAt?: string): Fixture {
  const lg = LEAGUES[f.div];
  const form = (rows: LiveFile["fixtures"][number]["form"][0]) =>
    rows.map(([gf, ga, venue, opp]) => ({ gf: String(gf), ga: String(ga), venue, opp: opp as OppTier }));
  return {
    id: f.id,
    league: { id: f.div, name: lg?.name ?? f.div, country: lg?.country ?? "", tier: lg?.tier ?? 3 },
    kickoff: f.t,
    home: displayName(f.home),
    away: displayName(f.away),
    homeForm: form(f.form[0]),
    awayForm: form(f.form[1]),
    homeCorners: { for: f.corners[0][0], against: f.corners[0][1] },
    awayCorners: { for: f.corners[1][0], against: f.corners[1][1] },
    odds: f.odds as Record<string, number>,
    best: f.best as Record<string, number>,
    probs: f.probs,
    xg: f.xg,
    cornersMean: f.cornersMean,
    hasCorners: true,
    status: "SCHEDULED",
    oddsUpdated: generatedAt,
  };
}

export const FileProvider: DataProvider = {
  name: "football-data.co.uk",
  isDemo: false,
  async getFixtures(from, to) {
    const file = await loadLiveFile();
    if (!file) throw new Error("Match data isn't available yet. It refreshes every 6 hours; try again shortly.");
    return file.fixtures.filter((f) => new Date(f.t) >= from && new Date(f.t) < to).map((f) => toFixture(f, file.generatedAt));
  },
  async getResult(id): Promise<ResultOrVoid | null> {
    const file = await loadLiveFile();
    const r = file?.results.find((x) => x[0] === id);
    if (!r) return null;
    const [, home, away, hh, ha, corners] = r;
    const missing: ("ht" | "corners")[] = [];
    if (hh < 0 || ha < 0) missing.push("ht");
    if (corners < 0) missing.push("corners");
    return { home, away, htHome: Math.max(0, hh), htAway: Math.max(0, ha), corners: Math.max(0, corners), missing };
  },
};
