import { Quality } from "../types";

/** Standard normal CDF (Abramowitz & Stegun 26.2.17, error < 1e-7). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export type Ranges = Record<string, [number, number]>;

/** Min/max of every probability across a set of scenarios. */
export function mergeRanges(scenarios: Record<string, number>[]): Ranges {
  const out: Ranges = {};
  for (const s of scenarios) {
    for (const [k, v] of Object.entries(s)) {
      if (!out[k]) out[k] = [v, v];
      else {
        out[k][0] = Math.min(out[k][0], v);
        out[k][1] = Math.max(out[k][1], v);
      }
    }
  }
  return out;
}

export interface BaseModel {
  probs: Record<string, number>;
  ranges: Ranges;
  quality: Quality;
  qualityNote: string;
  insights: string[];
}
