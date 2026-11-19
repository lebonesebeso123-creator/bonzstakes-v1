import { FootballInputs, FormMatch, OppTier, Quality, Venue } from "../types";
import { clamp } from "../format";
import { BaseModel, mergeRanges } from "./common";

const GOAL_CAP = 8;
const RHO = -0.08; // Dixon-Coles low-score correlation
const DECAY = 0.92; // weight lost per match back in time
const PRIOR = 4; // pseudo-matches of "league average" blended into each team

const TIER: Record<OppTier, { gf: number; ga: number }> = {
  strong: { gf: 0.88, ga: 1.12 },
  avg: { gf: 1, ga: 1 },
  weak: { gf: 1.12, ga: 0.88 },
};

interface Parsed {
  gf: number;
  ga: number;
  venue: Venue;
  opp: OppTier;
}

/** Keep only rows with a valid score on both sides. */
export function validRows(rows: FormMatch[]): Parsed[] {
  const out: Parsed[] = [];
  for (const r of rows) {
    const gf = r.gf.trim() === "" ? NaN : Number(r.gf);
    const ga = r.ga.trim() === "" ? NaN : Number(r.ga);
    if (Number.isInteger(gf) && Number.isInteger(ga) && gf >= 0 && ga >= 0 && gf <= 20 && ga <= 20) {
      out.push({ gf, ga, venue: r.venue, opp: r.opp });
    }
  }
  return out;
}

export interface Strength {
  attack: number;
  defence: number; // goals conceded relative to average (lower = better)
  weight: number;
}

export function teamStrength(
  form: Parsed[],
  muHome: number,
  muAway: number,
  muNeutral: number
): Strength {
  let wGf = 0,
    wBaseGf = 0,
    wGa = 0,
    wBaseGa = 0,
    weight = 0;
  form.forEach((m, i) => {
    const w = Math.pow(DECAY, i);
    const base =
      m.venue === "H"
        ? { gf: muHome, ga: muAway }
        : m.venue === "A"
        ? { gf: muAway, ga: muHome }
        : { gf: muNeutral, ga: muNeutral };
    const t = TIER[m.opp];
    wGf += w * m.gf;
    wGa += w * m.ga;
    wBaseGf += w * base.gf * t.gf;
    wBaseGa += w * base.ga * t.ga;
    weight += w;
  });
  if (weight === 0) return { attack: 1, defence: 1, weight: 0 };
  const rawAtt = wGf / wBaseGf;
  const rawDef = wGa / wBaseGa;
  return {
    attack: (weight * rawAtt + PRIOR) / (weight + PRIOR),
    defence: (weight * rawDef + PRIOR) / (weight + PRIOR),
    weight,
  };
}

function pmfRow(lambda: number): number[] {
  const row = [Math.exp(-lambda)];
  for (let k = 1; k <= GOAL_CAP; k++) row.push((row[k - 1] * lambda) / k);
  return row;
}

function tau(h: number, a: number, lh: number, la: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

export function scoreMatrix(lh: number, la: number): number[][] {
  const ph = pmfRow(lh);
  const pa = pmfRow(la);
  let total = 0;
  const m: number[][] = [];
  for (let h = 0; h <= GOAL_CAP; h++) {
    m[h] = [];
    for (let a = 0; a <= GOAL_CAP; a++) {
      const p = ph[h] * pa[a] * tau(h, a, lh, la);
      m[h][a] = p;
      total += p;
    }
  }
  for (let h = 0; h <= GOAL_CAP; h++) for (let a = 0; a <= GOAL_CAP; a++) m[h][a] /= total;
  return m;
}

export const OU_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];

function marketsFromMatrix(m: number[][]): Record<string, number> {
  let home = 0,
    draw = 0,
    away = 0,
    btts = 0,
    cleanHome = 0,
    cleanAway = 0;
  const over: Record<number, number> = {};
  OU_LINES.forEach((l) => (over[l] = 0));
  for (let h = 0; h <= GOAL_CAP; h++) {
    for (let a = 0; a <= GOAL_CAP; a++) {
      const p = m[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h > 0 && a > 0) btts += p;
      if (a === 0) cleanHome += p;
      if (h === 0) cleanAway += p;
      OU_LINES.forEach((l) => {
        if (h + a > l) over[l] += p;
      });
    }
  }
  const out: Record<string, number> = {
    home,
    draw,
    away,
    dc1X: home + draw,
    dcX2: draw + away,
    dc12: home + away,
    bttsYes: btts,
    bttsNo: 1 - btts,
    cleanHome,
    cleanAway,
  };
  OU_LINES.forEach((l) => {
    out[`over${l}`] = over[l];
    out[`under${l}`] = 1 - over[l];
  });
  return out;
}

export interface FootballModel extends BaseModel {
  lambdaHome: number;
  lambdaAway: number;
  matrix: number[][];
  topScores: { h: number; a: number; p: number }[];
  homeStrength: Strength;
  awayStrength: Strength;
  uncertainty: number;
}

export const DEFAULT_FOOTBALL: FootballInputs = {
  home: "",
  away: "",
  league: "",
  homeForm: [],
  awayForm: [],
  leagueGoals: 2.7,
  homeAdv: 1.25,
  neutral: false,
  homeAdj: { attack: 0, defence: 0 },
  awayAdj: { attack: 0, defence: 0 },
};

export function canAnalyseFootball(i: FootballInputs) {
  return validRows(i.homeForm).length >= 1 && validRows(i.awayForm).length >= 1;
}

export function predictFootball(i: FootballInputs): FootballModel | null {
  if (!canAnalyseFootball(i)) return null;

  const T = clamp(i.leagueGoals || 2.7, 1.5, 4.5);
  const ha = clamp(i.homeAdv || 1.25, 1, 2);
  const muHome = i.neutral ? T / 2 : (T * ha) / (1 + ha);
  const muAway = i.neutral ? T / 2 : T / (1 + ha);
  const muN = T / 2;

  const hf = validRows(i.homeForm);
  const af = validRows(i.awayForm);
  const hs = teamStrength(hf, muHome, muAway, muN);
  const as = teamStrength(af, muHome, muAway, muN);

  const att = (s: Strength, adj: { attack: number }) => s.attack * (1 + adj.attack / 100);
  const def = (s: Strength, adj: { defence: number }) => s.defence * (1 + adj.defence / 100);

  const lh = clamp(muHome * att(hs, i.homeAdj) * def(as, i.awayAdj), 0.15, 4.5);
  const la = clamp(muAway * att(as, i.awayAdj) * def(hs, i.homeAdj), 0.15, 4.5);

  const matrix = scoreMatrix(lh, la);
  const probs = marketsFromMatrix(matrix);

  const wMin = Math.min(hs.weight, as.weight);
  const u = clamp(0.3 / Math.sqrt(Math.max(wMin, 0.5)), 0.06, 0.28);
  const scenarios = [
    probs,
    ...[
      [1 + u, 1 + u],
      [1 - u, 1 - u],
      [1 + u, 1 - u],
      [1 - u, 1 + u],
    ].map(([fh, fa]) => marketsFromMatrix(scoreMatrix(lh * fh, la * fa))),
  ];
  const ranges = mergeRanges(scenarios);

  const topScores: { h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= 5; h++) for (let a = 0; a <= 5; a++) topScores.push({ h, a, p: matrix[h][a] });
  topScores.sort((x, y) => y.p - x.p);

  const nMin = Math.min(hf.length, af.length);
  const quality: Quality = nMin < 3 ? "poor" : nMin < 6 ? "limited" : "good";
  const short = hf.length <= af.length ? i.home || "Home team" : i.away || "Away team";
  const qualityNote =
    quality === "poor"
      ? `Only ${nMin} result${nMin === 1 ? "" : "s"} for ${short}. Treat everything as a rough guide.`
      : quality === "limited"
      ? `${nMin} results for ${short}. Add up to 10 for a steadier read.`
      : `${nMin}+ results per team. Reasonable sample, but form is not the whole story.`;

  const hn = i.home || "Home";
  const an = i.away || "Away";
  const insights: string[] = [];
  const diff = lh - la;
  insights.push(
    Math.abs(diff) < 0.2
      ? `Expected goals are close: ${hn} ${lh.toFixed(2)} vs ${an} ${la.toFixed(2)}.`
      : `${diff > 0 ? hn : an} has the edge on expected goals (${lh.toFixed(2)} vs ${la.toFixed(2)}).`
  );
  const best = (["home", "draw", "away"] as const).reduce((a, b) => (probs[a] > probs[b] ? a : b));
  insights.push(
    `Most likely 1X2 outcome: ${best === "home" ? hn : best === "away" ? an : "Draw"} at ${(probs[best] * 100).toFixed(0)}%. ` +
      `Realistic range ${(ranges[best][0] * 100).toFixed(0)}–${(ranges[best][1] * 100).toFixed(0)}%.`
  );
  insights.push(
    `Total goals expected ≈ ${(lh + la).toFixed(1)}. Over 2.5 is ${(probs["over2.5"] * 100).toFixed(0)}%, both teams to score ${(probs.bttsYes * 100).toFixed(0)}%.`
  );
  if (hs.attack > 1.15 || as.attack > 1.15) insights.push(`A hot attack is in the data. Check whether the opposition faced was above average.`);
  if (i.neutral) insights.push("Neutral venue: home advantage is switched off.");

  return {
    lambdaHome: lh,
    lambdaAway: la,
    matrix,
    topScores: topScores.slice(0, 6),
    homeStrength: hs,
    awayStrength: as,
    probs,
    ranges,
    quality,
    qualityNote,
    insights,
    uncertainty: u,
  };
}

/** Parse pasted results like "2-1 H, 0-0 A, 3:2 N" (most recent first). */
export function parseResults(text: string): FormMatch[] {
  const out: FormMatch[] = [];
  const re = /(\d{1,2})\s*[-:–]\s*(\d{1,2})(?:\s*\(?\s*([HAN])\s*\)?)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 10) {
    out.push({
      gf: m[1],
      ga: m[2],
      venue: ((m[3] || "H").toUpperCase() as Venue) || "H",
      opp: "avg",
    });
  }
  return out;
}
