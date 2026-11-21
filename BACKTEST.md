# BonzStakes backtest (21 Nov 2026)

Data: football-data.co.uk, 10 European leagues (E0, E1, SP1, I1, D1, F1, N1, P1, B1, SC0), 18,475 played matches 2021/22 to now.
Method: walk-forward. Every prediction uses only matches before kick-off. Settings were tuned on 2022/23–2023/24 and
scored on 2024/25 to now (7,933 matches) which tuning never saw. Bet365 stands in for Betway (not in the data).
Reproduce: `node scripts/fetch-data.mjs 5` then `npx tsx scripts/backtest.ts data/raw --json rows.json` and `npx tsx scripts/tune.ts rows.json`.

## Before (the app as it was)
| | Picks | Win ratio | Expected | Return | vs closing line |
|---|---|---|---|---|---|
| Daily top 10 "most likely" | 3,490 | 73.4% | 74.2% | −2.5% | −2.3% |
| Daily top 5 "value" at Bet365 | 1,369 | 43.2% | 50.9% | −9.7% | −4.7% |

Faults found
1. "Value" picks were mostly model error: when the form model disagreed with the market, the market was right.
2. Corners overconfident (landed 64.9% vs 73.8% expected): corner counts vary more than Poisson allows.
3. Goals markets slightly overconfident (71.4% vs 74.4%); half-time markets underconfident (82% vs 75%).
4. The 10-game form model was worse than a league average on over 2.5, and blending it 30% into prices made them worse.
5. Betfair Exchange pre-match snapshot (used as "sharp" from 2024/25) is stale: picks against it closed 5–6% worse.

## Fixes
- Probabilities now come from the market itself: margin removed from the average price, and every other market
  (BTTS, other goal lines, double chance, combos, half-time) derived from the goal expectations the 1X2 and
  over/under prices imply. The tuner gave the form/ratings model weight 0: it added nothing on unseen data.
- Half-time share fitted (0.46). Corners: negative binomial around the league average (team corner rates added nothing).
- Per-market logistic recalibration fitted on the training seasons.

## After (unseen seasons)
| | Picks | Win ratio | Expected | Return | vs closing line |
|---|---|---|---|---|---|
| Daily top 10 "most likely" | 3,490 | 74.9% | 74.4% | −1.4% at Bet365 | −2.7% |
| Value (edge ≥4%) at the best price on the market | 281 | 62.3% | 63.8% | +6.2% | +4.8% |
| Value at a single bookmaker (Bet365) | rare | | | | |

Log loss (lower is better) improved on every market, e.g. over 1.5 goals 0.535 → 0.524, over 3.5 0.612 → 0.598,
half-time over 0.5 0.590 → 0.583. Calibration: picks given 70–80% landed 74.8%; 30–40% landed 35.0%.

## What this means
- The chances shown are honest: a 75% pick lands about 75% of the time.
- Accurate chances alone don't beat one bookmaker's margin. The only positive result came from taking the best
  price across bookmakers, with positive closing-line value. Compare prices and type yours on the slip.
- Samples are 1.3 seasons; returns of a few percent are within luck. Track closing-line value before trusting profit.
