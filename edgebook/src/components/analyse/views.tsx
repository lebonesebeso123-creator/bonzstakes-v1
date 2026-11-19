import { ReactNode } from "react";
import { BasketballInputs, FootballInputs, Quality, Sport, TennisInputs } from "@/lib/types";
import { FootballModel } from "@/lib/models/football";
import { BasketballModel } from "@/lib/models/basketball";
import { TennisModel } from "@/lib/models/tennis";
import { GroupDef } from "./MarketsPanel";

export interface View {
  sport: Sport;
  title: string;
  league: string;
  groups: GroupDef[];
  main: {
    groupId: string;
    labels: { home: string; draw?: string; away: string };
    probs: { home: number; draw?: number; away: number };
    ranges: { home: [number, number]; draw?: [number, number]; away: [number, number] };
  };
  quality: Quality;
  qualityNote: string;
  insights: string[];
}

const g = (m: { probs: Record<string, number>; ranges: Record<string, [number, number]> }, key: string, label: string) => ({
  key,
  label,
  prob: m.probs[key],
  range: m.ranges[key],
});

export function footballView(i: FootballInputs, m: FootballModel, ouLine: number, ouControl: ReactNode): View {
  const hn = i.home.trim() || "Home";
  const an = i.away.trim() || "Away";
  return {
    sport: "football",
    title: `${hn} vs ${an}`,
    league: i.league,
    groups: [
      {
        id: "1x2",
        title: "Match result (1X2)",
        outcomes: [g(m, "home", `${hn} win`), g(m, "draw", "Draw"), g(m, "away", `${an} win`)],
      },
      {
        id: "ou",
        title: `Total goals: over/under ${ouLine}`,
        control: ouControl,
        outcomes: [g(m, `over${ouLine}`, `Over ${ouLine}`), g(m, `under${ouLine}`, `Under ${ouLine}`)],
      },
      {
        id: "btts",
        title: "Both teams to score",
        outcomes: [g(m, "bttsYes", "Yes"), g(m, "bttsNo", "No")],
      },
      {
        id: "dc",
        title: "Double chance",
        overlap: true,
        outcomes: [g(m, "dc1X", `${hn} or draw`), g(m, "dcX2", `Draw or ${an}`), g(m, "dc12", `${hn} or ${an}`)],
      },
    ],
    main: {
      groupId: "1x2",
      labels: { home: hn, draw: "Draw", away: an },
      probs: { home: m.probs.home, draw: m.probs.draw, away: m.probs.away },
      ranges: { home: m.ranges.home, draw: m.ranges.draw, away: m.ranges.away },
    },
    quality: m.quality,
    qualityNote: m.qualityNote,
    insights: m.insights,
  };
}

const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function basketballView(i: BasketballInputs, m: BasketballModel): View {
  const hn = i.home.trim() || "Home";
  const an = i.away.trim() || "Away";
  const groups: GroupDef[] = [
    {
      id: "ml",
      title: "Moneyline (to win)",
      outcomes: [g(m, "home", hn), g(m, "away", an)],
    },
  ];
  const spread = Number(i.spreadLine);
  if (i.spreadLine.trim() && isFinite(spread) && m.probs.spreadHome !== undefined) {
    groups.push({
      id: "spread",
      title: "Point spread",
      note: "Whole-number lines can push (refund); the model treats the result as continuous.",
      outcomes: [g(m, "spreadHome", `${hn} ${sgn(spread)}`), g(m, "spreadAway", `${an} ${sgn(-spread)}`)],
    });
  }
  if (i.totalLine.trim() && m.probs.over !== undefined) {
    groups.push({
      id: "total",
      title: `Total points: over/under ${i.totalLine}`,
      outcomes: [g(m, "over", `Over ${i.totalLine}`), g(m, "under", `Under ${i.totalLine}`)],
    });
  }
  return {
    sport: "basketball",
    title: `${hn} vs ${an}`,
    league: i.league,
    groups,
    main: {
      groupId: "ml",
      labels: { home: hn, away: an },
      probs: { home: m.probs.home, away: m.probs.away },
      ranges: { home: m.ranges.home, away: m.ranges.away },
    },
    quality: m.quality,
    qualityNote: m.qualityNote,
    insights: m.insights,
  };
}

export function tennisView(i: TennisInputs, m: TennisModel): View {
  const an = i.a.trim() || "Player A";
  const bn = i.b.trim() || "Player B";
  return {
    sport: "tennis",
    title: `${an} vs ${bn}`,
    league: i.tournament,
    groups: [
      {
        id: "winner",
        title: "Match winner",
        outcomes: [g(m, "home", an), g(m, "away", bn)],
      },
    ],
    main: {
      groupId: "winner",
      labels: { home: an, away: bn },
      probs: { home: m.probs.home, away: m.probs.away },
      ranges: { home: m.ranges.home, away: m.ranges.away },
    },
    quality: m.quality,
    qualityNote: m.qualityNote,
    insights: m.insights,
  };
}
