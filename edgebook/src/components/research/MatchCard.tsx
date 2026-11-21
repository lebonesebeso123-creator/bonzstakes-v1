"use client";

import { memo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { FormMatch } from "@/lib/types";
import { AnalysedMatch, Pick, isValue } from "@/lib/research/engine";
import { MARKET_GROUPS } from "@/lib/research/markets";
import PickButton from "./PickButton";

export function kickoffLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

export function ProbBar({ p }: { p: number }) {
  return (
    <span className="prob-track" aria-hidden>
      <span className="prob-fill" style={{ transform: `scaleX(${p})` }} />
    </span>
  );
}

export function PickRow({
  pick,
  m,
  inSlip,
  tag,
}: {
  pick: Pick;
  m: AnalysedMatch;
  inSlip: boolean;
  tag?: string;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      {tag && <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">{tag}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium">{pick.label}</span>
          {isValue(pick) && <span className="value-tag shrink-0">Value</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <ProbBar p={pick.prob} />
          <span className="num text-[12px] text-muted">
            {(pick.prob * 100).toFixed(0)}%<span className="opacity-60"> · fair {pick.fairOdds.toFixed(2)}</span>
            <span className="sr-only">
              {" "}estimated chance. Model alone {(pick.modelProb * 100).toFixed(0)}%
              {pick.implied !== null ? `, bookmaker ${(pick.implied * 100).toFixed(0)}%` : ", no bookmaker price"}.
            </span>
          </span>
        </div>
      </div>
      <PickButton pick={pick} fixture={m.fixture} active={inSlip} />
    </li>
  );
}

function FormRow({ team, form }: { team: string; form: FormMatch[] }) {
  const rows = form.slice(0, 6);
  const res = rows.map((r) => (Number(r.gf) > Number(r.ga) ? "W" : Number(r.gf) === Number(r.ga) ? "D" : "L"));
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-[13px]">{team}</span>
      <span className="flex shrink-0 gap-1" aria-label={`Last ${rows.length}: ${res.join(", ")}`}>
        {rows.map((r, i) => (
          <span
            key={i}
            className="form-pill"
            data-r={res[i]}
            title={`${r.gf}–${r.ga} ${r.venue === "H" ? "home" : "away"}`}
            aria-hidden
          >
            {res[i]}
          </span>
        ))}
      </span>
    </div>
  );
}

function researchLinks(home: string, away: string) {
  const q = (s: string) => `https://www.google.com/search?q=${encodeURIComponent(s)}`;
  return [
    { label: "Team news", href: q(`${home} vs ${away} team news injuries`) },
    { label: "Line-ups", href: q(`${home} vs ${away} predicted lineups`) },
    { label: "Head to head", href: q(`${home} vs ${away} head to head`) },
    { label: "Stats", href: q(`${home} vs ${away} stats preview`) },
  ];
}

function MatchCard({ m, slipKey }: { m: AnalysedMatch; slipKey?: string }) {
  const [open, setOpen] = useState(false);
  const f = m.fixture;
  const k = kickoffLabel(f.kickoff);
  const groups = MARKET_GROUPS.filter((g) => m.options.some((o) => o.group === g.id));

  return (
    <article className="card min-w-0 overflow-hidden" aria-label={`${f.home} versus ${f.away}`}>
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1">
        <div className="min-w-0">
          <div className="num text-[12px] text-muted">
            {k.day} · {k.time}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug">
            <span className="block truncate">{f.home}</span>
            <span className="block truncate">{f.away}</span>
          </h3>
        </div>
        <dl className="num shrink-0 text-right text-[12px] leading-5 text-muted">
          <div>
            <dt className="inline">xG </dt>
            <dd className="inline text-foreground">
              {m.xgHome.toFixed(1)}–{m.xgAway.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="inline">Corners </dt>
            <dd className="inline text-foreground">{m.corners.toFixed(1)}</dd>
          </div>
          {m.quality !== "good" && <div className="text-warn">{m.quality === "poor" ? "Thin data" : "Limited data"}</div>}
        </dl>
      </header>

      <ul className="divide-y px-4 pb-1" style={{ borderColor: "var(--border)" }}>
        {m.best.map((p) => (
          <PickRow
            key={p.key}
            pick={p}
            m={m}
            inSlip={slipKey === p.key}
            tag={MARKET_GROUPS.find((g) => g.id === p.group)?.short}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t text-[13px] font-medium text-muted transition-colors hover-fg"
        style={{ borderColor: "var(--border)" }}
      >
        {open ? "Hide markets" : `All ${m.options.length} selections`}
        <ChevronDown size={15} aria-hidden className="chev" data-open={open} />
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <section>
            <h4 className="h-section mb-1.5 !text-[11px]">Form · newest first</h4>
            <div className="space-y-1.5">
              <FormRow team={f.home} form={f.homeForm} />
              <FormRow team={f.away} form={f.awayForm} />
            </div>
          </section>
          {groups.map((g) => (
            <section key={g.id}>
              <h4 className="h-section mb-1.5 !text-[11px]">{g.label}</h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {m.options
                  .filter((o) => o.group === g.id)
                  .map((o) => (
                    <li key={o.key} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface)" }}>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{o.label}</span>
                        <span className="num text-[11px] text-muted">
                          {(o.prob * 100).toFixed(0)}% · fair {o.fairOdds.toFixed(2)}
                          {isValue(o) && <span className="ml-1.5 text-accent">value</span>}
                        </span>
                      </span>
                      <PickButton pick={o} fixture={f} active={slipKey === o.key} compact />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <section>
            <h4 className="h-section mb-1.5 !text-[11px]">Dig deeper</h4>
            <div className="flex flex-wrap gap-2">
              {researchLinks(f.home, f.away).map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="chip">
                  {l.label}
                  <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

export default memo(MatchCard);
