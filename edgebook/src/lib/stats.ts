import { AppState, Bet, SavedAnalysis } from "./types";

export function betProfit(b: Bet): number {
  if (b.status === "won") return b.stake * (b.odds - 1);
  if (b.status === "lost") return -b.stake;
  return 0;
}

export function bankrollOf(s: AppState) {
  const adj = s.adjustments.reduce((a, x) => a + x.amount, 0);
  const openStake = s.bets.filter((b) => b.status === "open").reduce((a, b) => a + b.stake, 0);
  const profit = s.bets.reduce((a, b) => a + betProfit(b), 0);
  const balance = s.startingBankroll + adj + profit - openStake;
  return { balance, openStake, profit, adjustments: adj, total: balance + openStake };
}

export function summarise(bets: Bet[]) {
  const settled = bets
    .filter((b) => b.status !== "open")
    .sort((a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? ""));
  const priced = settled.filter((b) => b.status !== "void");
  const won = priced.filter((b) => b.status === "won").length;
  const staked = priced.reduce((a, b) => a + b.stake, 0);
  const profit = priced.reduce((a, b) => a + betProfit(b), 0);

  let curW = 0,
    curL = 0,
    maxW = 0,
    maxL = 0;
  for (const b of priced) {
    if (b.status === "won") {
      curW++;
      curL = 0;
    } else {
      curL++;
      curW = 0;
    }
    maxW = Math.max(maxW, curW);
    maxL = Math.max(maxL, curL);
  }

  const clvBets = priced.filter((b) => b.closingOdds && b.closingOdds > 1);
  const avgClv = clvBets.length
    ? clvBets.reduce((a, b) => a + (b.odds / (b.closingOdds as number) - 1), 0) / clvBets.length
    : null;

  return {
    settled: settled.length,
    priced: priced.length,
    won,
    lost: priced.length - won,
    voids: settled.length - priced.length,
    staked,
    profit,
    roi: staked > 0 ? profit / staked : null,
    winRate: priced.length ? won / priced.length : null,
    avgOdds: priced.length ? priced.reduce((a, b) => a + b.odds, 0) / priced.length : null,
    avgStake: priced.length ? staked / priced.length : null,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    avgClv,
    clvCount: clvBets.length,
  };
}

export function bankrollSeries(s: AppState): { label: string; value: number }[] {
  type Ev = { t: string; delta: number };
  const evs: Ev[] = [
    ...s.adjustments.map((a) => ({ t: a.date, delta: a.amount })),
    ...s.bets
      .filter((b) => b.status !== "open" && b.settledAt)
      .map((b) => ({ t: b.settledAt as string, delta: betProfit(b) })),
  ].sort((a, b) => a.t.localeCompare(b.t));
  let bal = s.startingBankroll;
  const pts = [{ label: "Start", value: bal }];
  evs.forEach((e, i) => {
    bal += e.delta;
    pts.push({ label: `#${i + 1}`, value: bal });
  });
  return pts;
}

export function maxDrawdown(series: { value: number }[]): number {
  let peak = -Infinity,
    dd = 0;
  for (const p of series) {
    peak = Math.max(peak, p.value);
    if (peak > 0) dd = Math.max(dd, (peak - p.value) / peak);
  }
  return dd;
}

export function breakdown(bets: Bet[], key: "sport" | "market") {
  const map = new Map<string, Bet[]>();
  bets
    .filter((b) => b.status === "won" || b.status === "lost")
    .forEach((b) => {
      const k = b[key];
      map.set(k, [...(map.get(k) ?? []), b]);
    });
  return [...map.entries()]
    .map(([k, list]) => {
      const staked = list.reduce((a, b) => a + b.stake, 0);
      const profit = list.reduce((a, b) => a + betProfit(b), 0);
      return {
        key: k,
        n: list.length,
        won: list.filter((b) => b.status === "won").length,
        staked,
        profit,
        roi: staked ? profit / staked : 0,
      };
    })
    .sort((a, b) => b.n - a.n);
}

/** Compare model and market on analyses where you recorded the result. */
export function calibration(analyses: SavedAnalysis[]) {
  const rows = analyses
    .filter((a) => a.result)
    .map((a) => {
      const r = a.result!;
      let outcome: "home" | "draw" | "away" | null = null;
      if (a.sport === "tennis") outcome = r.winner === "a" ? "home" : r.winner === "b" ? "away" : null;
      else if (r.home !== undefined && r.away !== undefined)
        outcome = r.home > r.away ? "home" : r.home < r.away ? "away" : "draw";
      return { a, outcome };
    })
    .filter((x) => x.outcome !== null);

  const ll = (p: number) => -Math.log(Math.max(p, 1e-6));
  let modelLL = 0,
    n = 0,
    brier = 0;
  let mLL = 0,
    mkLL = 0,
    nMk = 0;
  for (const { a, outcome } of rows) {
    const p = a.summary.probs;
    const pOut = p[outcome as "home" | "away" | "draw"] ?? 0;
    modelLL += ll(pOut);
    const keys: ("home" | "draw" | "away")[] = ["home", ...(p.draw !== undefined ? (["draw"] as const) : []), "away"];
    brier += keys.reduce((s, k) => s + Math.pow((p[k] ?? 0) - (k === outcome ? 1 : 0), 2), 0);
    n++;
    const f = a.summary.marketFair;
    if (f) {
      const fOut = f[outcome as "home" | "away" | "draw"] ?? 0;
      mLL += ll(pOut);
      mkLL += ll(fOut);
      nMk++;
    }
  }
  return {
    n,
    modelLogLoss: n ? modelLL / n : null,
    brier: n ? brier / n : null,
    nMarket: nMk,
    modelVsMarket: nMk ? { model: mLL / nMk, market: mkLL / nMk } : null,
  };
}
