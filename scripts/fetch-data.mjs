/**
 * Downloads results, stats and odds from football-data.co.uk (free CSVs, no key).
 *   data/raw/<season>/<DIV>.csv   e.g. data/raw/2526/E0.csv
 *   data/raw/fixtures.csv         upcoming matches with odds
 *   data/raw/manifest.json        what was fetched, sizes and any errors
 * Run: node scripts/fetch-data.mjs [seasonsBack=5]
 */
import { mkdir, writeFile } from "node:fs/promises";

export const DIVISIONS = {
  E0: "Premier League",
  E1: "Championship",
  SP1: "La Liga",
  I1: "Serie A",
  D1: "Bundesliga",
  F1: "Ligue 1",
  N1: "Eredivisie",
  P1: "Primeira Liga",
  B1: "Pro League",
  SC0: "Premiership",
};

const BASE = "https://www.football-data.co.uk";
const UA = { "User-Agent": "Mozilla/5.0 (BonzStakes data pipeline; personal use)" };

/** Season code for a date: Aug–Jul seasons, e.g. Nov 2026 → "2627". */
export function seasonFor(d = new Date()) {
  const y = d.getUTCFullYear() % 100;
  const start = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${String(start).padStart(2, "0")}${String(start + 1).padStart(2, "0")}`;
}
const prev = (s) => {
  const a = Number(s.slice(0, 2)) - 1;
  return `${String(a).padStart(2, "0")}${String(a + 1).padStart(2, "0")}`;
};

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`failed: ${url}`);
}

const back = Number(process.argv[2] ?? 5);
const seasons = [seasonFor()];
for (let i = 0; i < back; i++) seasons.push(prev(seasons.at(-1)));

const manifest = { fetchedAt: new Date().toISOString(), seasons, files: {}, errors: [] };
for (const s of seasons) {
  await mkdir(`data/raw/${s}`, { recursive: true });
  for (const div of Object.keys(DIVISIONS)) {
    const url = `${BASE}/mmz4281/${s}/${div}.csv`;
    try {
      const text = await get(url);
      if (!text) {
        manifest.errors.push(`${s}/${div}: not found`);
        continue;
      }
      await writeFile(`data/raw/${s}/${div}.csv`, text);
      manifest.files[`${s}/${div}`] = text.split("\n").length - 1;
    } catch (e) {
      manifest.errors.push(`${s}/${div}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // be polite
  }
}
for (const f of ["fixtures.csv"]) {
  try {
    const text = await get(`${BASE}/${f}`);
    if (text) {
      await writeFile(`data/raw/${f}`, text);
      manifest.files[f] = text.split("\n").length - 1;
    }
  } catch (e) {
    manifest.errors.push(`${f}: ${e.message}`);
  }
}
await writeFile("data/raw/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`fetched ${Object.keys(manifest.files).length} files, ${manifest.errors.length} errors`);
if (!Object.keys(manifest.files).length) process.exit(1);
