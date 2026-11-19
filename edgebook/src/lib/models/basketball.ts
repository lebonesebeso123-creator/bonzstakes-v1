import { BasketballInputs, Quality } from "../types";
import { clamp, num } from "../format";
import { BaseModel, mergeRanges, normCdf } from "./common";

const PRIOR = 4;

export const DEFAULT_BASKETBALL: BasketballInputs = {
  home: "",
  away: "",
  league: "",
  homeGames: "",
  homeFor: "",
  homeAgainst: "",
  awayGames: "",
  awayFor: "",
  awayAgainst: "",
  leaguePoints: 112,
  homeCourt: 2.5,
  sdMargin: 12,
  sdTotal: 18,
  spreadLine: "",
  totalLine: "",
};

export interface BasketballModel extends BaseModel {
  expHome: number;
  expAway: number;
  margin: number;
  total: number;
}

export function predictBasketball(i: BasketballInputs): BasketballModel | null {
  const nH = num(i.homeGames, 0);
  const nA = num(i.awayGames, 0);
  const pfH = num(i.homeFor);
  const paH = num(i.homeAgainst);
  const pfA = num(i.awayFor);
  const paA = num(i.awayAgainst);
  if ([pfH, paH, pfA, paA].some((v) => isNaN(v)) || nH < 1 || nA < 1) return null;

  const L = clamp(i.leaguePoints, 40, 200);
  const shrink = (v: number, n: number) => (n * v + PRIOR * L) / (n + PRIOR);
  const sPfH = shrink(pfH, nH);
  const sPaH = shrink(paH, nH);
  const sPfA = shrink(pfA, nA);
  const sPaA = shrink(paA, nA);

  const hc = i.homeCourt;
  const expHome = (sPfH + sPaA) / 2 + hc / 2;
  const expAway = (sPfA + sPaH) / 2 - hc / 2;
  const margin = expHome - expAway;
  const total = expHome + expAway;

  const spread = num(i.spreadLine);
  const tline = num(i.totalLine);

  const calc = (mg: number, tot: number) => {
    const out: Record<string, number> = { home: normCdf(mg / i.sdMargin) };
    out.away = 1 - out.home;
    if (!isNaN(spread)) {
      out.spreadHome = normCdf((mg + spread) / i.sdMargin);
      out.spreadAway = 1 - out.spreadHome;
    }
    if (!isNaN(tline)) {
      out.over = 1 - normCdf((tline - tot) / i.sdTotal);
      out.under = 1 - out.over;
    }
    return out;
  };

  const nMin = Math.min(nH, nA);
  const d = clamp(6 / Math.sqrt(nMin), 1, 4);
  const probs = calc(margin, total);
  const ranges = mergeRanges([
    probs,
    calc(margin + d, total + d * 1.2),
    calc(margin - d, total - d * 1.2),
    calc(margin + d, total - d * 1.2),
    calc(margin - d, total + d * 1.2),
  ]);

  const quality: Quality = nMin < 4 ? "poor" : nMin < 8 ? "limited" : "good";
  const hn = i.home || "Home";
  const an = i.away || "Away";
  const insights = [
    `Projected score ${hn} ${expHome.toFixed(0)} – ${an} ${expAway.toFixed(0)} (margin ${margin > 0 ? "+" : ""}${margin.toFixed(1)}, total ${total.toFixed(0)}).`,
    `${margin >= 0 ? hn : an} wins ${(Math.max(probs.home, probs.away) * 100).toFixed(0)}% of the time in this model.`,
  ];
  if (isNaN(spread) && isNaN(tline)) insights.push("Add the spread and total lines to price those markets too.");

  return {
    expHome,
    expAway,
    margin,
    total,
    probs,
    ranges,
    quality,
    qualityNote:
      quality === "good"
        ? "Solid sample of recent games."
        : `Only ${nMin} games for one team. Basketball scoring is noisy, so keep stakes small.`,
    insights,
  };
}
