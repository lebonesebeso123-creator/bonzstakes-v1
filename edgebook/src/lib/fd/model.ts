/**
 * Team-strength models fitted on real results (football-data.co.uk).
 * Everything here only ever looks at matches *before* the one being predicted.
 */
import { FdMatch, played } from "./csv";

export interface Ratings {
  /** goals per game baselines for this league */
  muHome: number;
  muAway: number;
  attack: Map<string, number>;
  defence: Map<string, number>;
  /** effective number of (weighted) matches per team, a confidence measure */
  weight: Map<string, number>;
}

export interface FitOptions {
  /** half-life of a result's influence, in days */
  halfLife: number;
  /** pseudo-matches pulling each team toward a prior */
  prior: number;
  /** look-back window in days */
  window: number;
  /** prior for teams with no history in this league (e.g. promoted): attack, defence multipliers */
  newcomer: [number, number];
}

export const DEFAULT_FIT: FitOptions = { halfLife: 180, prior: 6, window: 760, newcomer: [0.86, 1.14] };

type Stat = "goals" | "corners" | "htgoals" | "sot";
const val = (m: FdMatch, side: "h" | "a", stat: Stat): number | undefined => {
  if (stat === "goals") return side === "h" ? m.fh : m.fa;
  if (stat === "corners") return side === "h" ? m.hc : m.ac;
  if (stat === "sot") return side === "h" ? m.hst : m.ast;
  return side === "h" ? m.hh : m.ha;
};

/**
 * Weighted Poisson strengths by iterative proportional fitting:
 *   E[home] = muHome · att(home) · def(away),  E[away] = muAway · att(away) · def(home)
 */
export function fitRatings(history: FdMatch[], at: number, opts: FitOptions = DEFAULT_FIT, stat: Stat = "goals", known?: Set<string>): Ratings {
  const k = Math.LN2 / opts.halfLife;
  const ms: { h: string; a: string; x: number; y: number; w: number }[] = [];
  for (const m of history) {
    const age = (at - Date.parse(m.t)) / 86400_000;
    if (age <= 0 || age > opts.window || !played(m)) continue;
    const x = val(m, "h", stat);
    const y = val(m, "a", stat);
    if (x === undefined || y === undefined) continue;
    ms.push({ h: m.home, a: m.away, x, y, w: Math.exp(-k * age) });
  }
  let sw = 0, sx = 0, sy = 0;
  for (const m of ms) {
    sw += m.w;
    sx += m.w * m.x;
    sy += m.w * m.y;
  }
  const muHome = sw ? sx / sw : 1.45;
  const muAway = sw ? sy / sw : 1.15;
  const teams = new Set<string>();
  ms.forEach((m) => (teams.add(m.h), teams.add(m.a)));
  const att = new Map<string, number>();
  const def = new Map<string, number>();
  const wt = new Map<string, number>();
  const pA = new Map<string, number>();
  const pD = new Map<string, number>();
  for (const t of teams) {
    const isNew = known ? !known.has(t) : false;
    pA.set(t, isNew ? opts.newcomer[0] : 1);
    pD.set(t, isNew ? opts.newcomer[1] : 1);
    att.set(t, pA.get(t)!);
    def.set(t, pD.get(t)!);
    wt.set(t, 0);
  }
  for (const m of ms) {
    wt.set(m.h, wt.get(m.h)! + m.w);
    wt.set(m.a, wt.get(m.a)! + m.w);
  }
  for (let it = 0; it < 12; it++) {
    const scoredW = new Map<string, number>(), expS = new Map<string, number>();
    const concW = new Map<string, number>(), expC = new Map<string, number>();
    for (const t of teams) {
      scoredW.set(t, 0); expS.set(t, 0); concW.set(t, 0); expC.set(t, 0);
    }
    for (const m of ms) {
      const eh = muHome * def.get(m.a)!; // what an average attack would score at home vs this defence
      const ea = muAway * def.get(m.h)!;
      scoredW.set(m.h, scoredW.get(m.h)! + m.w * m.x);
      expS.set(m.h, expS.get(m.h)! + m.w * eh);
      scoredW.set(m.a, scoredW.get(m.a)! + m.w * m.y);
      expS.set(m.a, expS.get(m.a)! + m.w * ea);
      concW.set(m.a, concW.get(m.a)! + m.w * m.x);
      expC.set(m.a, expC.get(m.a)! + m.w * muHome * att.get(m.h)!);
      concW.set(m.h, concW.get(m.h)! + m.w * m.y);
      expC.set(m.h, expC.get(m.h)! + m.w * muAway * att.get(m.a)!);
    }
    for (const t of teams) {
      att.set(t, (scoredW.get(t)! + opts.prior * pA.get(t)!) / (expS.get(t)! + opts.prior));
      def.set(t, (concW.get(t)! + opts.prior * pD.get(t)!) / (expC.get(t)! + opts.prior));
    }
    // keep the average team at 1
    const n = teams.size || 1;
    const ga = [...att.values()].reduce((a, b) => a + b, 0) / n;
    const gd = [...def.values()].reduce((a, b) => a + b, 0) / n;
    for (const t of teams) {
      att.set(t, att.get(t)! / ga);
      def.set(t, def.get(t)! / gd);
    }
  }
  return { muHome, muAway, attack: att, defence: def, weight: wt };
}

export function expected(r: Ratings, home: string, away: string, newcomer: [number, number] = DEFAULT_FIT.newcomer) {
  const ah = r.attack.get(home) ?? newcomer[0];
  const dh = r.defence.get(home) ?? newcomer[1];
  const aa = r.attack.get(away) ?? newcomer[0];
  const da = r.defence.get(away) ?? newcomer[1];
  return {
    home: Math.min(4.5, Math.max(0.15, r.muHome * ah * da)),
    away: Math.min(4.5, Math.max(0.15, r.muAway * aa * dh)),
    confidence: Math.min(r.weight.get(home) ?? 0, r.weight.get(away) ?? 0),
  };
}
