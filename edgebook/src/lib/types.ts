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

export interface MatchResultData {
  home: number;
  away: number;
  htHome: number;
  htAway: number;
  corners?: number;
}

/** One selection on a slip. One per match; combo picks count as one selection. */
export interface Leg {
  id: string;
  fixtureId: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  group: string;
  key: string;
  selection: string;
  odds: number;
  /** false when `odds` was estimated (no bookmaker price) and should be replaced with yours */
  priced?: boolean;
  /** BonzStakes estimate when added */
  prob: number;
  modelProb?: number;
  status: BetStatus;
  result?: MatchResultData;
}

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
  /** present for slips built on the Research page (singles have one leg) */
  legs?: Leg[];
}

/** One of the app's own top picks, recorded before kick-off and settled automatically. */
export interface TrackedPick {
  id: string; // fixtureId|key
  fixtureId: string;
  key: string;
  group: string;
  selection: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  /** local calendar day of kick-off, YYYY-MM-DD */
  day: string;
  kind: "likely" | "value";
  prob: number;
  odds: number;
  priced: boolean;
  recordedAt: string;
  status: BetStatus;
  result?: MatchResultData;
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
  /** your BonzStakes proxy URL; empty = demo data */
  dataUrl?: string;
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
  /** selections waiting on the bet slip */
  slip?: Leg[];
  /** the app's own daily picks, for the scorecard and learning */
  tracked?: TrackedPick[];
  /** learning ignores slips placed before this (set by "Reset learning") */
  learningSince?: string;
  /** ids of deleted bets/notes, so sync doesn't bring them back */
  deleted?: string[];
  /** last local change, used by sync */
  updatedAt?: string;
  sync?: { gistId?: string; token?: string; lastSync?: string };
}
