/**
 * "Why this pick": plain-English evidence from the form data behind a selection.
 * Each line is a fact you can check (counts from recent matches), never the model talking about itself.
 */
import { FormMatch } from "../types";
import { Fixture } from "./data";
import { HT_SHARE } from "./markets";

interface Row {
  gf: number;
  ga: number;
  venue: string;
}

const rows = (f: FormMatch[]): Row[] =>
  f
    .map((r) => ({ gf: Number(r.gf), ga: Number(r.ga), venue: r.venue }))
    .filter((r) => Number.isFinite(r.gf) && Number.isFinite(r.ga));

/** Prefer home-only (or away-only) games when there are enough of them. */
function sample(all: Row[], venue: "H" | "A") {
  const at = all.filter((r) => r.venue === venue);
  return at.length >= 4 ? { list: at, where: venue === "H" ? " at home" : " away" } : { list: all, where: "" };
}

const count = (list: Row[], fn: (r: Row) => boolean) => list.filter(fn).length;
const of = (k: number, n: number) => `${k} of their last ${n}`;

export interface Reason {
  text: string;
  /** how strongly the fact supports the pick, 0–1, used to choose the best line */
  weight: number;
}

function strongest(rs: (Reason | null)[], max = 2): string[] {
  return rs
    .filter((r): r is Reason => !!r && r.weight >= 0.6)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map((r) => r.text);
}

export function reasonsFor(key: string, f: Fixture, xg?: { home: number; away: number; corners: number }): string[] {
  const H = rows(f.homeForm);
  const A = rows(f.awayForm);
  if (H.length < 3 || A.length < 3) return [];
  const h = sample(H, "H");
  const a = sample(A, "A");
  const home = f.home;
  const away = f.away;

  const win = (s: { list: Row[]; where: string }, team: string): Reason => {
    const k = count(s.list, (r) => r.gf > r.ga);
    return { text: `${team} won ${of(k, s.list.length)}${s.where}`, weight: k / s.list.length };
  };
  const lose = (s: { list: Row[]; where: string }, team: string): Reason => {
    const k = count(s.list, (r) => r.gf < r.ga);
    return { text: `${team} lost ${of(k, s.list.length)}${s.where}`, weight: k / s.list.length };
  };
  const unbeaten = (s: { list: Row[]; where: string }, team: string): Reason => {
    const k = count(s.list, (r) => r.gf >= r.ga);
    return { text: `${team} unbeaten in ${of(k, s.list.length)}${s.where}`, weight: k / s.list.length };
  };
  const bothScored = (s: { list: Row[]; where: string }, team: string, yes: boolean): Reason => {
    const k = count(s.list, (r) => (r.gf > 0 && r.ga > 0) === yes);
    return {
      text: yes
        ? `Both teams scored in ${k} of ${team}'s last ${s.list.length}${s.where}`
        : `At least one side failed to score in ${k} of ${team}'s last ${s.list.length}${s.where}`,
      weight: k / s.list.length,
    };
  };
  const totals = (line: number, over: boolean): Reason[] => {
    const kH = count(h.list, (r) => (r.gf + r.ga > line) === over);
    const kA = count(a.list, (r) => (r.gf + r.ga > line) === over);
    const word = over ? "over" : "under";
    return [
      {
        text: `${kH} of ${home}'s last ${h.list.length}${h.where} and ${kA} of ${away}'s last ${a.list.length}${a.where} went ${word} ${line}`,
        weight: (kH / h.list.length + kA / a.list.length) / 2,
      },
    ];
  };
  const avgGoals = (list: Row[], side: "gf" | "ga") => list.reduce((s, r) => s + r[side], 0) / list.length;

  switch (key) {
    case "home":
      return strongest([win(h, home), lose(a, away)]);
    case "away":
      return strongest([win(a, away), lose(h, home)]);
    case "draw": {
      const k = count([...h.list, ...a.list], (r) => r.gf === r.ga);
      const n = h.list.length + a.list.length;
      return [`${k} draws in the two sides' last ${n} games combined`];
    }
    case "dc1X":
      return strongest([unbeaten(h, home), win(h, home)], 1).concat(strongest([lose(a, away)], 1));
    case "dcX2":
      return strongest([unbeaten(a, away), win(a, away)], 1).concat(strongest([lose(h, home)], 1));
    case "dc12": {
      const k = count([...h.list, ...a.list], (r) => r.gf !== r.ga);
      return [`${k} of the two sides' last ${h.list.length + a.list.length} games had a winner`];
    }
    case "bttsYes":
      return strongest([bothScored(h, home, true), bothScored(a, away, true)]);
    case "bttsNo": {
      const cs = (s: { list: Row[]; where: string }, team: string): Reason => {
        const k = count(s.list, (r) => r.ga === 0);
        return { text: `${team} kept ${k} clean sheets in their last ${s.list.length}${s.where}`, weight: k / s.list.length + 0.1 };
      };
      const blank = (s: { list: Row[]; where: string }, team: string): Reason => {
        const k = count(s.list, (r) => r.gf === 0);
        return { text: `${team} failed to score in ${of(k, s.list.length)}${s.where}`, weight: k / s.list.length + 0.1 };
      };
      return strongest([bothScored(h, home, false), bothScored(a, away, false), cs(h, home), cs(a, away), blank(h, home), blank(a, away)]);
    }
    case "over1.5":
    case "over2.5":
    case "over3.5":
    case "under1.5":
    case "under2.5":
    case "under3.5": {
      const over = key.startsWith("over");
      const line = Number(key.replace(/[a-z]/g, ""));
      const t = totals(line, over)[0];
      const lines = [t.text];
      const avg = avgGoals(h.list, "gf") + avgGoals(h.list, "ga") + avgGoals(a.list, "gf") + avgGoals(a.list, "ga");
      lines.push(`Their games average ${(avg / 2).toFixed(1)} goals`);
      return lines;
    }
    case "htBttsYes":
    case "htBttsNo":
    case "htOver0.5":
    case "htUnder0.5":
    case "htOver1.5": {
      if (!xg) return [];
      const ht = (xg.home + xg.away) * HT_SHARE;
      return [`About ${ht.toFixed(1)} first-half goals expected (${(xg.home + xg.away).toFixed(1)} for the match)`];
    }
    default:
      if (key.startsWith("c")) {
        const avg = (f.homeCorners.for + f.homeCorners.against + f.awayCorners.for + f.awayCorners.against) / 2;
        return [
          `Their matches average ${avg.toFixed(1)} corners`,
          `${home} win ${f.homeCorners.for.toFixed(1)} a game, ${away} ${f.awayCorners.for.toFixed(1)}`,
        ];
      }
      if (key === "homeBtts" || key === "homeO15") return strongest([win(h, home), key === "homeBtts" ? bothScored(a, away, true) : totals(1.5, true)[0]]);
      if (key === "awayBtts" || key === "awayO15") return strongest([win(a, away), key === "awayBtts" ? bothScored(h, home, true) : totals(1.5, true)[0]]);
      if (key === "bttsO25") return strongest([bothScored(h, home, true), totals(2.5, true)[0]]);
      return [];
  }
}
