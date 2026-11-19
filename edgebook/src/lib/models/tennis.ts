import { Quality, TennisInputs } from "../types";
import { clamp, num } from "../format";
import { BaseModel, logit, mergeRanges, sigmoid } from "./common";

const W_RANK = 0.35;
const W_FORM = 0.5;
const W_H2H = 0.8;
const PRIOR = 8;

export const DEFAULT_TENNIS: TennisInputs = {
  a: "",
  b: "",
  tournament: "",
  surface: "hard",
  bestOf: 3,
  rankA: "",
  rankB: "",
  winsA: "",
  lossesA: "",
  winsB: "",
  lossesB: "",
  h2hA: "",
  h2hB: "",
};

export interface TennisModel extends BaseModel {
  z: number;
  parts: { rank: number; form: number; h2h: number };
}

export function predictTennis(i: TennisInputs): TennisModel | null {
  const rA = num(i.rankA);
  const rB = num(i.rankB);
  const wA = num(i.winsA, 0),
    lA = num(i.lossesA, 0),
    wB = num(i.winsB, 0),
    lB = num(i.lossesB, 0);
  const nA = wA + lA;
  const nB = wB + lB;
  const hA = num(i.h2hA, 0);
  const hB = num(i.h2hB, 0);

  const hasRank = rA > 0 && rB > 0;
  const hasForm = nA > 0 && nB > 0;
  if (!hasRank && !hasForm) return null;

  const rate = (w: number, n: number) => (w + 0.5 * PRIOR) / (n + PRIOR);
  const rank = hasRank ? W_RANK * (Math.log(rB) - Math.log(rA)) : 0;
  const form = hasForm ? W_FORM * (logit(rate(wA, nA)) - logit(rate(wB, nB))) : 0;
  const h2h = W_H2H * ((hA - hB) / (hA + hB + 3));
  const boost = i.bestOf === 5 ? 1.2 : 1;
  const z = (rank + form + h2h) * boost;

  const nEff = hasForm ? Math.min(nA, nB) : 3;
  const dz = clamp(1.2 / Math.sqrt(Math.max(nEff, 1)), 0.2, 0.7);
  const make = (zz: number) => ({ home: sigmoid(zz), away: 1 - sigmoid(zz) });
  const probs = make(z);
  const ranges = mergeRanges([probs, make(z + dz), make(z - dz)]);

  const quality: Quality = !hasForm || nEff < 5 ? "poor" : nEff < 10 ? "limited" : "good";
  const an = i.a || "Player A";
  const bn = i.b || "Player B";
  const fav = probs.home >= 0.5 ? an : bn;
  const insights = [
    `${fav} is the model favourite at ${(Math.max(probs.home, probs.away) * 100).toFixed(0)}%.`,
    hasRank && hasForm
      ? `Ranking and recent ${i.surface} form are both included.`
      : hasRank
      ? "Ranking only. Add recent results on this surface for a better read."
      : "Form only. Adding rankings would help.",
  ];
  if (i.bestOf === 5) insights.push("Best of five favours the stronger player, so the edge is widened slightly.");

  return {
    z,
    parts: { rank, form, h2h },
    probs,
    ranges,
    quality,
    qualityNote:
      quality === "poor"
        ? "Very small or missing sample. This is a rough heuristic."
        : quality === "limited"
        ? "Moderate sample. Prefer results on the same surface."
        : "Reasonable sample. Still a simple heuristic, so track how it performs.",
    insights,
  };
}
