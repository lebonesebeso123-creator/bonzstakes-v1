/**
 * Match data for the Research page.
 *
 * `DemoProvider` generates realistic, repeatable fixtures, form, corners, odds and results so the
 * whole app works offline. To go live, implement `DataProvider` against a real API (e.g.
 * API-Football: /fixtures?date=, /odds?date=, /fixtures/statistics) and swap `dataProvider`.
 */
import { FormMatch, OppTier } from "../types";
import { MatchResult, probsFromRates } from "./markets";

export interface League {
  id: string;
  name: string;
  country: string;
  /** 1 = biggest. Results are listed by tier, then by name. */
  tier: 1 | 2 | 3;
}

export interface Fixture {
  id: string;
  league: League;
  kickoff: string; // ISO
  home: string;
  away: string;
  homeForm: FormMatch[]; // most recent first
  awayForm: FormMatch[];
  /** average corners won / conceded over recent matches */
  homeCorners: { for: number; against: number };
  awayCorners: { for: number; against: number };
  /** decimal bookmaker odds keyed by selection key (only markets the source prices) */
  odds: Record<string, number>;
  /** when the odds were last refreshed (ISO) */
  oddsUpdated?: string;
  /** false when the source has no corner stats; corners markets are then hidden */
  hasCorners?: boolean;
  /** source status, e.g. "SCHEDULED", "POSTPONED" */
  status?: string;
  /** calibrated probabilities from the data pipeline (used instead of the in-app model) */
  probs?: Record<string, number>;
  /** best price available across bookmakers */
  best?: Record<string, number>;
  /** expected goals and league corner average, for display and reasons */
  xg?: [number, number];
  cornersMean?: number;
}

/** What we know about a match we bet on, to find its result in sources that name teams differently. */
export interface MatchHint {
  home: string;
  away: string;
  kickoff: string;
}

/** A finished match, or "void" when it was postponed, cancelled or abandoned. */
export type ResultOrVoid = MatchResult | "void";

export interface DataProvider {
  readonly name: string;
  readonly isDemo: boolean;
  getFixtures(from: Date, to: Date): Promise<Fixture[]>;
  /** null until the match has finished; "void" if it won't be played */
  getResult(fixtureId: string, now?: Date, hint?: MatchHint): Promise<ResultOrVoid | null>;
}

/* ---------------- deterministic randomness ---------------- */

function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(r: () => number, mean: number): number {
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 30);
  return k - 1;
}

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
}

/* ---------------- demo leagues ---------------- */

interface DemoLeague extends League {
  goals: number; // league goals per game
  teams: string[]; // strongest first
  /** weekday per fixture slot (0 = Sun … 6 = Sat) */
  days: number[];
  midweek?: number;
}

const LEAGUES: DemoLeague[] = [
  {
    id: "epl", name: "Premier League", country: "England", tier: 1, goals: 2.85, days: [5, 6, 6, 6, 6, 0, 0, 1], midweek: 3,
    teams: ["Arsenal", "Liverpool", "Manchester City", "Chelsea", "Newcastle", "Aston Villa", "Tottenham", "Manchester United", "Brighton", "Crystal Palace", "Brentford", "Fulham", "Bournemouth", "Everton", "West Ham", "Nottingham Forest"],
  },
  {
    id: "laliga", name: "La Liga", country: "Spain", tier: 1, goals: 2.6, days: [5, 6, 6, 6, 0, 0, 0, 1],
    teams: ["Real Madrid", "Barcelona", "Atlético Madrid", "Athletic Club", "Villarreal", "Real Betis", "Real Sociedad", "Girona", "Sevilla", "Valencia", "Celta Vigo", "Osasuna", "Mallorca", "Getafe"],
  },
  {
    id: "seriea", name: "Serie A", country: "Italy", tier: 1, goals: 2.6, days: [5, 6, 6, 6, 0, 0, 0, 1],
    teams: ["Inter", "Napoli", "Juventus", "AC Milan", "Atalanta", "Roma", "Lazio", "Fiorentina", "Bologna", "Como", "Torino", "Udinese", "Genoa", "Cagliari"],
  },
  {
    id: "bundesliga", name: "Bundesliga", country: "Germany", tier: 1, goals: 3.1, days: [5, 6, 6, 6, 6, 0, 0],
    teams: ["Bayern Munich", "Bayer Leverkusen", "Borussia Dortmund", "RB Leipzig", "Eintracht Frankfurt", "Stuttgart", "Freiburg", "Wolfsburg", "Mainz", "Hoffenheim", "Werder Bremen", "Union Berlin"],
  },
  {
    id: "ligue1", name: "Ligue 1", country: "France", tier: 1, goals: 2.75, days: [5, 6, 6, 6, 0, 0, 0],
    teams: ["Paris Saint-Germain", "Marseille", "Monaco", "Lille", "Lyon", "Nice", "Lens", "Rennes", "Strasbourg", "Brest", "Toulouse", "Nantes"],
  },
  {
    id: "championship", name: "Championship", country: "England", tier: 2, goals: 2.55, days: [6, 6, 6, 6, 6, 0], midweek: 2,
    teams: ["Leeds United", "Burnley", "Sunderland", "Sheffield United", "Middlesbrough", "Coventry", "West Brom", "Norwich", "Bristol City", "Watford", "Millwall", "Stoke City"],
  },
  {
    id: "eredivisie", name: "Eredivisie", country: "Netherlands", tier: 2, goals: 3.2, days: [5, 6, 6, 0, 0, 0],
    teams: ["PSV", "Ajax", "Feyenoord", "AZ Alkmaar", "Twente", "Utrecht", "Go Ahead Eagles", "NEC", "Heerenveen", "Sparta Rotterdam"],
  },
  {
    id: "primeira", name: "Primeira Liga", country: "Portugal", tier: 2, goals: 2.6, days: [5, 6, 6, 0, 0, 1],
    teams: ["Sporting CP", "Benfica", "Porto", "Braga", "Vitória SC", "Santa Clara", "Famalicão", "Casa Pia", "Estoril", "Gil Vicente"],
  },
];

const KICKOFFS = ["12:30", "14:00", "15:00", "16:30", "17:30", "19:00", "20:00", "21:00"];

interface Rating {
  attack: number;
  defence: number;
  strength: number;
}

function rating(l: DemoLeague, idx: number): Rating {
  const r = rng(`rating:${l.id}:${l.teams[idx]}`);
  const s = 1.38 - (0.62 * idx) / Math.max(1, l.teams.length - 1) + (r() - 0.5) * 0.08;
  return { strength: s, attack: Math.pow(s, 0.95) * (0.95 + r() * 0.1), defence: Math.pow(1 / s, 0.85) * (0.95 + r() * 0.1) };
}

function trueRates(l: DemoLeague, h: number, a: number) {
  const rh = rating(l, h);
  const ra = rating(l, a);
  const ha = 1.22;
  const muH = (l.goals * ha) / (1 + ha);
  const muA = l.goals / (1 + ha);
  const lh = Math.min(4.2, Math.max(0.2, muH * rh.attack * ra.defence));
  const la = Math.min(4.2, Math.max(0.2, muA * ra.attack * rh.defence));
  const cf = (r: Rating) => 5 * Math.pow(r.attack, 0.7);
  const ca = (r: Rating) => 5 * Math.pow(r.defence, 0.6);
  const corners = (cf(rh) * 1.06 + ca(ra)) / 2 + (cf(ra) * 0.94 + ca(rh)) / 2;
  return { lh, la, corners, rh, ra };
}

function tierOf(l: DemoLeague, idx: number): OppTier {
  const third = l.teams.length / 3;
  return idx < third ? "strong" : idx < third * 2 ? "avg" : "weak";
}

function form(l: DemoLeague, team: number, seed: string) {
  const r = rng(`form:${seed}:${l.teams[team]}`);
  const rows: FormMatch[] = [];
  let cFor = 0;
  let cAg = 0;
  for (let k = 0; k < 8; k++) {
    let opp = Math.floor(r() * l.teams.length);
    if (opp === team) opp = (opp + 1) % l.teams.length;
    const home = (k + (hash(seed) % 2)) % 2 === 0;
    const t = home ? trueRates(l, team, opp) : trueRates(l, opp, team);
    const gf = poisson(r, home ? t.lh : t.la);
    const ga = poisson(r, home ? t.la : t.lh);
    const c = poisson(r, t.corners);
    const share = home ? 0.53 : 0.47;
    cFor += Math.round(c * share);
    cAg += c - Math.round(c * share);
    rows.push({ gf: String(gf), ga: String(ga), venue: home ? "H" : "A", opp: tierOf(l, opp) });
  }
  return { rows, corners: { for: +(cFor / 8).toFixed(1), against: +(cAg / 8).toFixed(1) } };
}

function bookOdds(l: DemoLeague, h: number, a: number, id: string): Record<string, number> {
  const t = trueRates(l, h, a);
  const p = probsFromRates(t.lh, t.la, t.corners);
  const r = rng(`odds:${id}`);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) {
    // bookmaker view = truth + their own error, plus a ~6% margin
    const z = Math.log(v / (1 - v)) + gauss(r) * 0.16;
    const q = Math.min(0.97, Math.max(0.02, 1 / (1 + Math.exp(-z))));
    out[k] = Math.max(1.03, Math.round((1 / (q * 1.06)) * 100) / 100);
  }
  return out;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function weekFixtures(l: DemoLeague, monday: Date): { id: string; h: number; a: number; kickoff: Date }[] {
  const out: { id: string; h: number; a: number; kickoff: Date }[] = [];
  const rounds: { tag: string; days: number[] }[] = [{ tag: "wk", days: l.days }];
  if (l.midweek !== undefined) rounds.push({ tag: "mid", days: [l.midweek] });
  for (const round of rounds) {
    const r = rng(`week:${l.id}:${ymd(monday)}:${round.tag}`);
    const order = l.teams.map((_, i) => i).sort(() => r() - 0.5);
    const pairs = round.tag === "mid" ? Math.min(3, order.length / 2) : order.length / 2;
    for (let j = 0; j < pairs; j++) {
      const h = order[j * 2];
      const a = order[j * 2 + 1];
      const day = round.days[j % round.days.length];
      const date = new Date(monday);
      date.setDate(monday.getDate() + ((day + 6) % 7));
      const [hh, mm] = KICKOFFS[Math.floor(r() * KICKOFFS.length)].split(":").map(Number);
      date.setHours(hh, mm, 0, 0);
      out.push({ id: `${l.id}|${ymd(date)}|${h}-${a}`, h, a, kickoff: date });
    }
  }
  return out;
}

function buildFixture(l: DemoLeague, f: { id: string; h: number; a: number; kickoff: Date }): Fixture {
  const hf = form(l, f.h, f.id);
  const af = form(l, f.a, f.id);
  return {
    id: f.id,
    league: { id: l.id, name: l.name, country: l.country, tier: l.tier },
    kickoff: f.kickoff.toISOString(),
    home: l.teams[f.h],
    away: l.teams[f.a],
    homeForm: hf.rows,
    awayForm: af.rows,
    homeCorners: hf.corners,
    awayCorners: af.corners,
    odds: bookOdds(l, f.h, f.a, f.id),
    oddsUpdated: new Date(Math.min(Date.now(), f.kickoff.getTime() - 3600_000 * 3)).toISOString(),
    hasCorners: true,
    status: isPostponed(f.id) ? "POSTPONED" : "SCHEDULED",
  };
}

export const DemoProvider: DataProvider = {
  name: "Demo data",
  isDemo: true,
  async getFixtures(from, to) {
    const out: Fixture[] = [];
    for (let m = mondayOf(from); m < to; m.setDate(m.getDate() + 7)) {
      for (const l of LEAGUES)
        for (const f of weekFixtures(l, new Date(m)))
          if (f.kickoff >= from && f.kickoff < to) out.push(buildFixture(l, f));
    }
    return out;
  },
  async getResult(fixtureId, now = new Date()) {
    const [lid, date, pair] = fixtureId.split("|");
    const l = LEAGUES.find((x) => x.id === lid);
    if (!pair) return null;
    if (!l) return "void"; // a league that was removed (e.g. Botswana, South Africa)
    const [h, a] = pair.split("-").map(Number);
    const fx = weekFixtures(l, mondayOf(new Date(`${date}T12:00:00`))).find((f) => f.id === fixtureId);
    if (!fx || now.getTime() < fx.kickoff.getTime() + 115 * 60_000) return null;
    if (isPostponed(fixtureId)) return "void";
    return simulateResult(fixtureId, l, h, a);
  },
};

/** About 1 in 60 demo matches gets postponed, to exercise voids. */
function isPostponed(id: string) {
  return hash(`pp:${id}`) % 60 === 0;
}

function simulateResult(id: string, l: DemoLeague, h: number, a: number): MatchResult {
  const t = trueRates(l, h, a);
  const r = rng(`result:${id}`);
  const htHome = poisson(r, t.lh * 0.44);
  const htAway = poisson(r, t.la * 0.44);
  return {
    htHome,
    htAway,
    home: htHome + poisson(r, t.lh * 0.56),
    away: htAway + poisson(r, t.la * 0.56),
    corners: poisson(r, t.corners),
  };
}

/** Demo only: the final result even if the match hasn't been played yet (for testing settlement). */
export function demoForceResult(fixtureId: string): ResultOrVoid | null {
  const [lid, , pair] = fixtureId.split("|");
  const l = LEAGUES.find((x) => x.id === lid);
  if (!l || !pair) return null;
  if (isPostponed(fixtureId)) return "void";
  const [h, a] = pair.split("-").map(Number);
  return simulateResult(fixtureId, l, h, a);
}


