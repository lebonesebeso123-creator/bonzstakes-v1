/**
 * Live data through your BonzStakes proxy (see /proxy in the repo):
 *   GET {base}/fd/competitions/{CODE}/matches  → football-data.org v4 (season fixtures + results)
 *   GET {base}/odds/{sport_key}                → The Odds API v4 (h2h + totals, decimal, EU books)
 * Responses are trimmed and cached in the browser so the free limits go a long way.
 */
import { FormMatch, OppTier } from "../types";
import { DataProvider, Fixture, League, ResultOrVoid } from "./data";

interface Comp extends League {
  code: string;
  oddsKey: string;
}

export const LIVE_COMPETITIONS: Comp[] = [
  { code: "PL", id: "PL", name: "Premier League", country: "England", tier: 1, oddsKey: "soccer_epl" },
  { code: "PD", id: "PD", name: "La Liga", country: "Spain", tier: 1, oddsKey: "soccer_spain_la_liga" },
  { code: "SA", id: "SA", name: "Serie A", country: "Italy", tier: 1, oddsKey: "soccer_italy_serie_a" },
  { code: "BL1", id: "BL1", name: "Bundesliga", country: "Germany", tier: 1, oddsKey: "soccer_germany_bundesliga" },
  { code: "FL1", id: "FL1", name: "Ligue 1", country: "France", tier: 1, oddsKey: "soccer_france_ligue_one" },
  { code: "CL", id: "CL", name: "Champions League", country: "Europe", tier: 1, oddsKey: "soccer_uefa_champs_league" },
  { code: "ELC", id: "ELC", name: "Championship", country: "England", tier: 2, oddsKey: "soccer_efl_champ" },
  { code: "DED", id: "DED", name: "Eredivisie", country: "Netherlands", tier: 2, oddsKey: "soccer_netherlands_eredivisie" },
  { code: "PPL", id: "PPL", name: "Primeira Liga", country: "Portugal", tier: 2, oddsKey: "soccer_portugal_primeira_liga" },
  { code: "BSA", id: "BSA", name: "Série A", country: "Brazil", tier: 2, oddsKey: "soccer_brazil_campeonato" },
];

/* ---------------- raw API shapes (only the fields we use) ---------------- */

interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
}
interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score?: {
    fullTime?: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
}
interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}
interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: { key: string; last_update: string; markets: { key: string; outcomes: OddsOutcome[] }[] }[];
}

/** Compact match kept in the browser cache. */
export interface LiteMatch {
  id: number;
  t: string; // utcDate
  s: string; // status
  h: number;
  a: number;
  hn: string;
  an: string;
  ft?: [number, number];
  ht?: [number, number];
}

export function liteMatches(raw: { matches?: FdMatch[] }): LiteMatch[] {
  return (raw.matches ?? []).map((m) => {
    const ft = m.score?.fullTime;
    const ht = m.score?.halfTime;
    return {
      id: m.id,
      t: m.utcDate,
      s: m.status,
      h: m.homeTeam?.id,
      a: m.awayTeam?.id,
      hn: m.homeTeam?.shortName || m.homeTeam?.name || "Home",
      an: m.awayTeam?.shortName || m.awayTeam?.name || "Away",
      ft: ft && ft.home !== null && ft.away !== null ? [ft.home, ft.away] : undefined,
      ht: ht && ht.home !== null && ht.away !== null ? [ht.home, ht.away] : undefined,
    };
  });
}

/* ---------------- team-name matching between the two APIs ---------------- */

const NOISE = new Set([
  "fc", "afc", "cf", "sc", "ac", "as", "ssc", "ud", "cd", "rc", "ss", "sv", "vfb", "vfl", "tsg", "fk", "club",
  "de", "calcio", "1", "football", "sporting", "the", "sad", "ec", "se", "us", "rcd", "ca", "sl", "bc",
]);

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && t !== "and");
}

export function nameSimilarity(a: string, b: string): number {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.length || !B.length) return 0;
  let hits = 0;
  for (const x of A) if (B.some((y) => y === x || (x.length >= 4 && y.length >= 4 && (y.startsWith(x) || x.startsWith(y))))) hits++;
  return hits / Math.max(A.length, B.length);
}

/** Finds the odds event for a fixture: kick-off within 3 hours and the best-matching names. */
export function matchEvent(home: string, away: string, kickoff: string, events: OddsEvent[]): OddsEvent | null {
  const t = new Date(kickoff).getTime();
  const near = events.filter((e) => Math.abs(new Date(e.commence_time).getTime() - t) <= 3 * 3600_000);
  let best: OddsEvent | null = null;
  let score = 0;
  for (const e of near) {
    const s = nameSimilarity(home, e.home_team) + nameSimilarity(away, e.away_team);
    if (s > score) {
      score = s;
      best = e;
    }
  }
  return score >= 0.6 ? best : null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Typical (median) price per selection across bookmakers. */
export function oddsFromEvent(e: OddsEvent): { odds: Record<string, number>; updated?: string } {
  const pools: Record<string, number[]> = {};
  let updated = "";
  const push = (k: string, p: number) => (pools[k] ??= []).push(p);
  for (const b of e.bookmakers ?? []) {
    if (b.last_update > updated) updated = b.last_update;
    for (const m of b.markets ?? []) {
      if (m.key === "h2h") {
        for (const o of m.outcomes) {
          if (o.name === e.home_team) push("home", o.price);
          else if (o.name === e.away_team) push("away", o.price);
          else if (o.name.toLowerCase() === "draw") push("draw", o.price);
        }
      } else if (m.key === "totals") {
        for (const o of m.outcomes) {
          if (o.point === undefined || ![1.5, 2.5, 3.5].includes(o.point)) continue;
          push(`${o.name.toLowerCase() === "over" ? "over" : "under"}${o.point}`, o.price);
        }
      }
    }
  }
  const odds: Record<string, number> = {};
  for (const [k, ps] of Object.entries(pools)) odds[k] = Math.round(median(ps) * 100) / 100;
  return { odds, updated: updated || undefined };
}

/* ---------------- form & standings from season results ---------------- */

function tiers(finished: LiteMatch[]): Map<number, OppTier> {
  const pts = new Map<number, number>();
  for (const m of finished) {
    const [h, a] = m.ft!;
    pts.set(m.h, (pts.get(m.h) ?? 0) + (h > a ? 3 : h === a ? 1 : 0));
    pts.set(m.a, (pts.get(m.a) ?? 0) + (a > h ? 3 : h === a ? 1 : 0));
  }
  const order = [...pts.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
  const out = new Map<number, OppTier>();
  order.forEach((id, i) => out.set(id, i < order.length / 3 ? "strong" : i < (2 * order.length) / 3 ? "avg" : "weak"));
  return out;
}

export function formFor(team: number, before: string, finished: LiteMatch[], tier: Map<number, OppTier>): FormMatch[] {
  return finished
    .filter((m) => (m.h === team || m.a === team) && m.t < before)
    .sort((x, y) => y.t.localeCompare(x.t))
    .slice(0, 10)
    .map((m) => {
      const home = m.h === team;
      return {
        gf: String(home ? m.ft![0] : m.ft![1]),
        ga: String(home ? m.ft![1] : m.ft![0]),
        venue: home ? "H" : "A",
        opp: tier.get(home ? m.a : m.h) ?? "avg",
      };
    });
}

/* ---------------- fetching with a browser cache ---------------- */

const CACHE_PREFIX = "bonzstakes:cache:";

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = localStorage.getItem(CACHE_PREFIX + key);
    if (hit) {
      const { at, data } = JSON.parse(hit);
      if (Date.now() - at < ttlMs) return data as T;
    }
  } catch {
    /* ignore */
  }
  const data = await load();
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full: still return fresh data */
  }
  return data;
}

export class LiveError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new LiveError("Can't reach your data proxy. Check your connection and the proxy URL in Account.");
  }
  if (r.status === 429) throw new LiveError("The free data limit was hit. Try again in a minute (odds refresh twice a day).", 429);
  if (r.status === 401 || r.status === 403) throw new LiveError("The data proxy refused the request. Check its API keys and allowed site.", r.status);
  if (!r.ok) throw new LiveError(`Data source error (${r.status}).`, r.status);
  return r.json() as Promise<T>;
}

export function createLiveProvider(base: string): DataProvider {
  const root = base.replace(/\/+$/, "");
  const season = (c: Comp) =>
    cached(`fd:${c.code}`, 30 * 60_000, async () =>
      liteMatches(await getJson<{ matches: FdMatch[] }>(`${root}/fd/competitions/${c.code}/matches`))
    );
  const events = (c: Comp) => cached(`odds:${c.oddsKey}`, 12 * 3600_000, () => getJson<OddsEvent[]>(`${root}/odds/${c.oddsKey}`));

  return {
    name: "Live: football-data.org + The Odds API",
    isDemo: false,
    async getFixtures(from, to) {
      const out: Fixture[] = [];
      const errors: unknown[] = [];
      // sequential: football-data.org's free plan allows 10 calls a minute
      for (const c of LIVE_COMPETITIONS) {
        let ms: LiteMatch[];
        try {
          ms = await season(c);
        } catch (e) {
          errors.push(e);
          continue;
        }
        const upcoming = ms.filter(
          (m) => (m.s === "SCHEDULED" || m.s === "TIMED") && new Date(m.t) >= from && new Date(m.t) < to
        );
        if (!upcoming.length) continue;
        const finished = ms.filter((m) => m.s === "FINISHED" && m.ft);
        const tier = tiers(finished);
        let evs: OddsEvent[] = [];
        try {
          evs = await events(c);
        } catch {
          /* odds are optional: the model still runs, prices show as estimates */
        }
        for (const m of upcoming) {
          const ev = matchEvent(m.hn, m.an, m.t, evs);
          const { odds, updated } = ev ? oddsFromEvent(ev) : { odds: {}, updated: undefined };
          out.push({
            id: `fd:${c.code}:${m.id}`,
            league: { id: c.id, name: c.name, country: c.country, tier: c.tier },
            kickoff: m.t,
            home: m.hn,
            away: m.an,
            homeForm: formFor(m.h, m.t, finished, tier),
            awayForm: formFor(m.a, m.t, finished, tier),
            homeCorners: { for: 5, against: 5 },
            awayCorners: { for: 5, against: 5 },
            odds,
            oddsUpdated: updated,
            hasCorners: false,
            status: m.s,
          });
        }
      }
      if (!out.length && errors.length) throw errors[0];
      return out;
    },
    async getResult(fixtureId, now = new Date()): Promise<ResultOrVoid | null> {
      const [, code, idStr] = fixtureId.split(":");
      const c = LIVE_COMPETITIONS.find((x) => x.code === code);
      if (!c) return null;
      const m = (await season(c)).find((x) => x.id === Number(idStr));
      if (!m) return null;
      return liteResult(m, now);
    },
  };
}

/** Settlement rules: finished → score; cancelled → void; postponed for over 48h → void. */
export function liteResult(m: LiteMatch, now = new Date()): ResultOrVoid | null {
  if ((m.s === "FINISHED" || m.s === "AWARDED") && m.ft) {
    return {
      home: m.ft[0],
      away: m.ft[1],
      htHome: m.ht?.[0] ?? 0,
      htAway: m.ht?.[1] ?? 0,
      corners: 0,
      missing: m.ht ? ["corners"] : ["ht", "corners"],
    };
  }
  if (m.s === "CANCELLED") return "void";
  if ((m.s === "POSTPONED" || m.s === "SUSPENDED") && now.getTime() - new Date(m.t).getTime() > 48 * 3600_000) return "void";
  return null;
}
