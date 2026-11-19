export type Sport = "football" | "basketball" | "tennis";
export type Venue = "H" | "A" | "N";
export type OppTier = "strong" | "avg" | "weak";
export type Quality = "poor" | "limited" | "good";
export type Verdict = "value" | "lean" | "fair" | "pass";

/** One recent result as typed by the user (strings so empty cells stay empty). */
export interface FormMatch {
  gf: string;
  ga: string;
  venue: Venue;
  opp: OppTier;
}

export interface SquadAdj {
  /** % change to attack, negative = weaker */
  attack: number;
  /** % change to goals conceded, positive = leakier */
  defence: number;
}

export interface FootballInputs {
  home: string;
  away: string;
  league: string;
  homeForm: FormMatch[];
  awayForm: FormMatch[];
  leagueGoals: number;
  homeAdv: number;
  neutral: boolean;
  homeAdj: SquadAdj;
  awayAdj: SquadAdj;
}

export interface BasketballInputs {
  home: string;
  away: string;
  league: string;
  homeGames: string;
  homeFor: string;
  homeAgainst: string;
  awayGames: string;
  awayFor: string;
  awayAgainst: string;
  leaguePoints: number;
  homeCourt: number;
  sdMargin: number;
  sdTotal: number;
  spreadLine: string;
  totalLine: string;
}

export type Surface = "hard" | "clay" | "grass" | "indoor";

export interface TennisInputs {
  a: string;
  b: string;
  tournament: string;
  surface: Surface;
  bestOf: 3 | 5;
  rankA: string;
  rankB: string;
  winsA: string;
  lossesA: string;
  winsB: string;
  lossesB: string;
  h2hA: string;
  h2hB: string;
}

export type OddsMap = Record<string, string>;

export interface AnalysisSummary {
  probs: { home: number; draw?: number; away: number };
  marketFair?: { home: number; draw?: number; away: number };
  quality: Quality;
  headline: string;
  bestEdge?: { label: string; ev: number; odds: number };
}

export interface AnalysisResult {
  /** football goals / basketball points */
  home?: number;
  away?: number;
  /** tennis winner */
  winner?: "a" | "b";
}

export interface SavedAnalysis {
  id: string;
  sport: Sport;
  title: string;
  league?: string;
  createdAt: string;
  updatedAt: string;
  inputs: FootballInputs | BasketballInputs | TennisInputs;
  odds: OddsMap;
  checklist: string[];
  notes: string;
  summary: AnalysisSummary;
  result?: AnalysisResult;
}

export type BetStatus = "open" | "won" | "lost" | "void";

export interface Bet {
  id: string;
  analysisId?: string;
  sport: Sport;
  matchLabel: string;
  market: string;
  selection: string;
  odds: number;
  stake: number;
  status: BetStatus;
  placedAt: string;
  settledAt?: string;
  closingOdds?: number;
  modelProb?: number;
  fairProb?: number;
  note?: string;
}

export interface Adjustment {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  tag?: string;
}

export interface Settings {
  currency: string;
  kellyFraction: number;
  maxStakePct: number;
  evThreshold: number;
}

export interface AppState {
  v: 2;
  ackAt: string | null;
  startingBankroll: number;
  adjustments: Adjustment[];
  bets: Bet[];
  analyses: SavedAnalysis[];
  notes: Note[];
  settings: Settings;
}
