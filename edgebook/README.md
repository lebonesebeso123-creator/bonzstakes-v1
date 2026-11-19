# BonzStakes

A private, free **match analysis and paper-bet research journal** for football, basketball and tennis.

You enter recent results and the bookmaker's odds. BonzStakes estimates probabilities with transparent
models, shows where your view and the market disagree, and lets you track *paper* bets to find out
whether your edge is real. No accounts, no tracking, no real money. Everything is stored in your browser.

## Features

- **Football**: weighted recent form (home/away and opposition-adjusted) → expected goals →
  Poisson + Dixon–Coles → 1X2, over/under ladder, BTTS, double chance, exact-score grid.
- **Basketball**: moneyline, point spread and totals from scoring/defence and home-court advantage.
- **Tennis**: ranking, surface form and head-to-head heuristic.
- **Honest uncertainty**: every probability has a range that widens with small samples; data-quality badge.
- **Market comparison**: margin removal, edge, EV, verdicts (Value / Lean / Fair / Pass), cautious fractional-Kelly stake.
- **Paper bets**: settle, reopen, closing-line value, bankroll curve, ROI, drawdown, by-sport/market breakdown.
- **Model scorecard**: record final results and compare the model's log loss with the market's.
- **Journal**: saved analyses (reopen anytime), notes with tags and search, pre-bet checklist, research links.
- **Privacy**: local-only storage, JSON backup/restore, 18+ gate, responsible-use guidance.
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
