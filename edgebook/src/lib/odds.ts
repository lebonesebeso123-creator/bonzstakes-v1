import { Quality, Verdict } from "./types";

/** Parse decimal ("2.5", "2,5") or fractional ("5/2") odds. Returns null if invalid. */
export function parseOdds(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    if (!isFinite(a) || !isFinite(b) || b <= 0) return null;
    const d = a / b + 1;
    return d > 1.01 && d < 1000 ? d : null;
  }
  const n = Number(s);
  return isFinite(n) && n > 1.01 && n < 1000 ? n : null;
}

/** Remove the bookmaker margin (proportional method). Needs every outcome priced. */
export function fairProbs(odds: (number | null)[]): { fair: number[]; margin: number } | null {
  if (odds.some((o) => o === null)) return null;
  const raw = (odds as number[]).map((o) => 1 / o);
  const sum = raw.reduce((a, b) => a + b, 0);
  return { fair: raw.map((r) => r / sum), margin: sum - 1 };
}

/** Expected value per 1 unit staked. */
export function expectedValue(p: number, odds: number): number {
  return p * odds - 1;
}

/** Full-Kelly fraction of bankroll (0 if no edge). */
export function kellyFraction(p: number, odds: number): number {
  const b = odds - 1;
  if (b <= 0) return 0;
  return Math.max(0, (p * b - (1 - p)) / b);
}

export function suggestStake(
  bankroll: number,
  p: number,
  odds: number,
  fraction: number,
  maxPct: number
): number {
  if (bankroll <= 0) return 0;
  const k = kellyFraction(p, odds) * fraction;
  const capped = Math.min(k, maxPct / 100);
  return Math.floor(bankroll * capped * 100) / 100;
}

export function verdictFor(
  evModel: number,
  evConservative: number,
  quality: Quality,
  threshold: number
): Verdict {
  if (evConservative > 0 && evModel >= threshold && quality !== "poor") return "value";
  if (evModel >= threshold) return "lean";
  if (evModel > -0.04) return "fair";
  return "pass";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  value: "Value",
  lean: "Lean",
  fair: "Fair price",
  pass: "Pass",
};
