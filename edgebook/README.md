# BonzStakes

A private, free **match research tool and paper-bet tracker** for football.

Pick a time frame and markets; BonzStakes scans every match, ranks the picks, finds value against the odds,
builds slips to a target price and tracks *paper* bets so you can see whether the edge is real. No accounts,
no real money. Everything is stored in your browser.

## Features

- **Research (home page)**: choose a time frame (today → next 7 days) and markets (1X2, double chance,
  BTTS, total goals, corners, 1st-half BTTS/goals, combos). One tap scans every match, grouped by league
  (biggest first), with the best pick per market, "Most likely" and "Value vs the odds" suggestions, and a
  slip builder that hits your target odds with the highest combined probability.
- **Bet slip**: one pick per match (combo picks count as one), total odds, stake, placed straight to Bets.
  Selections settle automatically from results, and each market's hit rate feeds back into future estimates.
- **Data**: runs on built-in demo data. To go live, implement `DataProvider` in `src/lib/research/data.ts`.

- **Model**: weighted recent form → expected goals → Poisson + Dixon–Coles, blended 30/70 with market prices.
- **Research tools**: team/league search, sort by kick-off, most likely or best value, value-only filter,
  recent form and research links on every match.
- **Bets & learning**: ROI, drawdown, bankroll curve, by-market breakdown, per-market learning table.
- **Journal**: notes with tags and search. **Privacy**: local-only storage, JSON backup/restore, 18+ gate.
- Accessible (keyboard, screen readers, reduced motion), mobile-first, installable manifest.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # model + odds unit tests
npm run lint
npm run build && npm start
```

Requires Node 20+. No environment variables or API keys are needed.

## Deploy

It is a standard Next.js app with no server state, so it deploys as-is to Vercel, Netlify or any
Node host (`npm run build`, `npm start`). Before going public, set your site URL via
`metadataBase` in `src/app/layout.tsx` if you want absolute social-share URLs.

## Project layout

```
src/lib/models/   football.ts · basketball.ts · tennis.ts · common.ts   (pure, unit-tested)
src/lib/odds.ts   odds parsing, margin removal, EV, Kelly
src/lib/store.ts  localStorage store (useSyncExternalStore), backup/restore, migration
src/lib/stats.ts  bankroll, ROI, drawdown, CLV, model-vs-market scorecard
src/components/   UI kit, charts, analyse/* (forms, markets panel, summary)
src/app/          / (Analyse) · /bets · /journal · /account · /about
tests/            node:test suites (run with tsx)
```

## Important

This is a research tool, not betting advice. Probabilities are estimates. Bookmakers' prices are
usually sharper than simple form-based models, so track closing-line value and the model scorecard
over many bets before believing you have an edge. For adults (18+) only. Follow the gambling laws where you live.
