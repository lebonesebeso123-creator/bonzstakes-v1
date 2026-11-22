/** Shape of public/data/live.json, built every 6 hours by the GitHub Action. */

export const LEAGUES: Record<string, { name: string; country: string; tier: 1 | 2 | 3 }> = {
  E0: { name: "Premier League", country: "England", tier: 1 },
  SP1: { name: "La Liga", country: "Spain", tier: 1 },
  I1: { name: "Serie A", country: "Italy", tier: 1 },
  D1: { name: "Bundesliga", country: "Germany", tier: 1 },
  F1: { name: "Ligue 1", country: "France", tier: 1 },
  E1: { name: "Championship", country: "England", tier: 2 },
  N1: { name: "Eredivisie", country: "Netherlands", tier: 2 },
  P1: { name: "Primeira Liga", country: "Portugal", tier: 2 },
  B1: { name: "Pro League", country: "Belgium", tier: 2 },
  SC0: { name: "Premiership", country: "Scotland", tier: 2 },
};

/** football-data.co.uk abbreviates many club names; show the names people know. */
const NAMES: Record<string, string> = {
  "Man United": "Manchester United", "Man City": "Manchester City", "Nott'm Forest": "Nottingham Forest", "Wolves": "Wolverhampton",
  "Sheffield Weds": "Sheffield Wednesday", "Sheffield United": "Sheffield United", "West Brom": "West Bromwich Albion", "QPR": "Queens Park Rangers",
  "Ath Madrid": "Atlético Madrid", "Ath Bilbao": "Athletic Club", "Sociedad": "Real Sociedad", "Betis": "Real Betis", "Celta": "Celta Vigo",
  "Vallecano": "Rayo Vallecano", "Espanol": "Espanyol", "Alaves": "Alavés", "Leganes": "Leganés", "Cadiz": "Cádiz", "Almeria": "Almería",
  "Ein Frankfurt": "Eintracht Frankfurt", "M'gladbach": "Borussia Mönchengladbach", "Leverkusen": "Bayer Leverkusen", "Dortmund": "Borussia Dortmund",
  "FC Koln": "FC Köln", "Bayern Munich": "Bayern Munich", "Hertha": "Hertha Berlin", "Fortuna Dusseldorf": "Fortuna Düsseldorf",
  "Paris SG": "Paris Saint-Germain", "St Etienne": "Saint-Étienne", "Inter": "Inter Milan", "Milan": "AC Milan", "Verona": "Hellas Verona",
  "Sp Lisbon": "Sporting CP", "Sp Braga": "Braga", "Guimaraes": "Vitória SC", "Pacos Ferreira": "Paços de Ferreira",
  "For Sittard": "Fortuna Sittard", "Nijmegen": "NEC Nijmegen", "Go Ahead Eagles": "Go Ahead Eagles", "St Truiden": "Sint-Truiden",
  "St. Gilloise": "Union Saint-Gilloise", "Club Brugge": "Club Brugge", "Oud-Heverlee Leuven": "OH Leuven", "Dundee United": "Dundee United",
  "St Mirren": "St Mirren", "St Johnstone": "St Johnstone",
};
export const displayName = (n: string) => NAMES[n] ?? n;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const fixtureId = (div: string, t: string, home: string, away: string) => `fdc:${div}:${t.slice(0, 10)}:${slug(home)}~${slug(away)}`;

export type Prices = Partial<Record<"home" | "draw" | "away" | "over2.5" | "under2.5", number>>;

export interface LiveFixture {
  id: string;
  div: string;
  t: string;
  home: string;
  away: string;
  /** calibrated probabilities for every selection */
  probs: Record<string, number>;
  /** Bet365 prices: a typical soft bookmaker, our stand-in for Betway */
  odds: Prices;
  /** market average and best available prices */
  avg: Prices;
  best: Prices;
  /** ratings-model expected goals */
  xg: [number, number];
  cornersMean: number;
  /** last 10 league games, newest first: [scored, conceded, venue, opponent tier] */
  form: [[number, number, "H" | "A", string][], [number, number, "H" | "A", string][]];
  /** average corners [won, conceded] over the last 10 */
  corners: [[number, number], [number, number]];
}

export interface BacktestStat {
  picks: number;
  winRatio: number;
  expected: number;
  roi: number | null;
  clv: number | null;
}

export interface LiveFile {
  generatedAt: string;
  source: string;
  fixtures: LiveFixture[];
  /** football-data.co.uk results: [id, ftHome, ftAway, htHome, htAway, totalCorners]; -1 = not available */
  results: [string, number, number, number, number, number][];
  /** fast final scores (ESPN), matched by league, kick-off and team names:
   *  [div, kickoff, home, away, status "FT"|"VOID", ftHome, ftAway, htHome, htAway, corners]; -1 = not available */
  fast?: [string, string, string, string, string, number, number, number, number, number][];
  backtest: { testedOn: number; seasons: string; trainedOn: string; topPicks: BacktestStat; valueBest: BacktestStat; valueSoft: BacktestStat };
}
