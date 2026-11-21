/**
 * football-data.co.uk CSV → compact match records.
 * Column guide: https://www.football-data.co.uk/notes.txt
 */

export interface Odds3 {
  h: number;
  d: number;
  a: number;
}
export interface Odds2 {
  o: number; // over 2.5
  u: number; // under 2.5
}

export interface FdMatch {
  div: string;
  /** kick-off, ISO UTC */
  t: string;
  home: string;
  away: string;
  /** full time / half time goals; undefined for upcoming fixtures */
  fh?: number;
  fa?: number;
  hh?: number;
  ha?: number;
  /** corners, shots, shots on target */
  hc?: number;
  ac?: number;
  hs?: number;
  as?: number;
  hst?: number;
  ast?: number;
  /** pre-match prices (when the CSV was compiled, typically Fri/Tue) */
  pin?: Odds3; // Pinnacle
  b365?: Odds3; // Bet365, our stand-in for a soft bookmaker like Betway
  avg?: Odds3; // market average
  max?: Odds3; // best available
  pinOU?: Odds2;
  b365OU?: Odds2;
  avgOU?: Odds2;
  maxOU?: Odds2;
  /** closing prices */
  pinC?: Odds3;
  avgC?: Odds3;
  b365C?: Odds3;
  pinCOU?: Odds2;
  avgCOU?: Odds2;
  /** Betfair Exchange (sharp, from 2024/25) */
  bfe?: Odds3;
  bfeC?: Odds3;
  bfeOU?: Odds2;
  bfeCOU?: Odds2;
  b365COU?: Odds2;
}

export function splitCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^,+$/.test(l))
    .map((l) => l.split(","));
}

/** Last Sunday of a month (UTC date). */
function lastSunday(y: number, m: number) {
  const d = new Date(Date.UTC(y, m + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/** UK local date + time → UTC ISO (handles GMT/BST). Times in the files are UK time. */
export function ukToUtc(date: string, time: string | undefined): string | null {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const mo = Number(m[2]) - 1;
  const d = Number(m[1]);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}$/.test(time) ? time : "15:00").split(":").map(Number);
  const local = Date.UTC(y, mo, d, hh, mm);
  const bstStart = lastSunday(y, 2).getTime() + 3600_000; // 01:00 UTC
  const bstEnd = lastSunday(y, 9).getTime() + 3600_000;
  const offset = local >= bstStart + 3600_000 && local < bstEnd + 3600_000 ? 3600_000 : 0;
  return new Date(local - offset).toISOString();
}

const num = (s: string | undefined) => {
  if (s === undefined || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function parseFd(text: string): FdMatch[] {
  const rows = splitCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  const ix = (name: string) => head.indexOf(name);
  const out: FdMatch[] = [];
  for (const r of rows.slice(1)) {
    const g = (name: string) => {
      const i = ix(name);
      return i >= 0 ? r[i]?.trim() : undefined;
    };
    const n = (name: string) => num(g(name));
    const o3 = (h: string, d: string, a: string): Odds3 | undefined => {
      const x = { h: n(h), d: n(d), a: n(a) };
      return x.h && x.d && x.a && x.h > 1 && x.d > 1 && x.a > 1 ? (x as Odds3) : undefined;
    };
    const o2 = (o: string, u: string): Odds2 | undefined => {
      const x = { o: n(o), u: n(u) };
      return x.o && x.u && x.o > 1 && x.u > 1 ? (x as Odds2) : undefined;
    };
    const home = g("HomeTeam") ?? g("Home");
    const away = g("AwayTeam") ?? g("Away");
    const t = ukToUtc(g("Date") ?? "", g("Time"));
    if (!home || !away || !t) continue;
    out.push({
      div: g("Div") ?? "",
      t,
      home,
      away,
      fh: n("FTHG") ?? n("HG"),
      fa: n("FTAG") ?? n("AG"),
      hh: n("HTHG"),
      ha: n("HTAG"),
      hc: n("HC"),
      ac: n("AC"),
      hs: n("HS"),
      as: n("AS"),
      hst: n("HST"),
      ast: n("AST"),
      pin: o3("PSH", "PSD", "PSA"),
      b365: o3("B365H", "B365D", "B365A"),
      avg: o3("AvgH", "AvgD", "AvgA") ?? o3("BbAvH", "BbAvD", "BbAvA"),
      max: o3("MaxH", "MaxD", "MaxA") ?? o3("BbMxH", "BbMxD", "BbMxA"),
      pinOU: o2("P>2.5", "P<2.5"),
      b365OU: o2("B365>2.5", "B365<2.5"),
      avgOU: o2("Avg>2.5", "Avg<2.5") ?? o2("BbAv>2.5", "BbAv<2.5"),
      maxOU: o2("Max>2.5", "Max<2.5") ?? o2("BbMx>2.5", "BbMx<2.5"),
      pinC: o3("PSCH", "PSCD", "PSCA"),
      avgC: o3("AvgCH", "AvgCD", "AvgCA"),
      b365C: o3("B365CH", "B365CD", "B365CA"),
      pinCOU: o2("PC>2.5", "PC<2.5"),
      avgCOU: o2("AvgC>2.5", "AvgC<2.5"),
      bfe: o3("BFEH", "BFED", "BFEA"),
      bfeC: o3("BFECH", "BFECD", "BFECA"),
      bfeOU: o2("BFE>2.5", "BFE<2.5"),
      bfeCOU: o2("BFEC>2.5", "BFEC<2.5"),
      b365COU: o2("B365C>2.5", "B365C<2.5"),
    });
  }
  return out;
}

/** Margin-free probabilities from a full set of prices. */
export function fair3(o?: Odds3) {
  if (!o) return undefined;
  const s = 1 / o.h + 1 / o.d + 1 / o.a;
  return { h: 1 / o.h / s, d: 1 / o.d / s, a: 1 / o.a / s };
}
export function fair2(o?: Odds2) {
  if (!o) return undefined;
  const s = 1 / o.o + 1 / o.u;
  return { o: 1 / o.o / s, u: 1 / o.u / s };
}

export const played = (m: FdMatch) => m.fh !== undefined && m.fa !== undefined;
