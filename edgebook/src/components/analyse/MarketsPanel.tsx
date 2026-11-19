"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { RangeBar } from "@/components/charts";
import { fairProbs, expectedValue, parseOdds, suggestStake, verdictFor, VERDICT_LABEL } from "@/lib/odds";
import { money, pct, signedPct } from "@/lib/format";
import { OddsMap, Quality, Settings, Verdict } from "@/lib/types";

export interface OutcomeDef {
  key: string;
  label: string;
  prob: number;
  range: [number, number];
}

export interface GroupDef {
  id: string;
  title: string;
  note?: string;
  outcomes: OutcomeDef[];
  control?: ReactNode;
  /** Outcomes overlap (e.g. double chance), so no margin removal. */
  overlap?: boolean;
}

export interface BetDraft {
  key: string;
  groupTitle: string;
  selection: string;
  odds: number;
  prob: number;
  fair?: number;
  suggested: number;
}

export interface Evaluated {
  key: string;
  label: string;
  groupTitle: string;
  odds: number;
  prob: number;
  fair?: number;
  ev: number;
}

const TONE: Record<Verdict, "green" | "amber" | "neutral" | "red"> = {
  value: "green",
  lean: "amber",
  fair: "neutral",
  pass: "red",
};

/** Evaluate every priced outcome, used for both the UI and the saved summary. */
export function evaluate(groups: GroupDef[], odds: OddsMap): Evaluated[] {
  const out: Evaluated[] = [];
  for (const g of groups) {
    const parsed = g.outcomes.map((o) => parseOdds(odds[o.key]));
    const fp = g.overlap ? null : fairProbs(parsed);
    g.outcomes.forEach((o, i) => {
      const od = parsed[i];
      if (od) {
        out.push({
          key: o.key,
          label: o.label,
          groupTitle: g.title,
          odds: od,
          prob: o.prob,
          fair: fp?.fair[i],
          ev: expectedValue(o.prob, od),
        });
      }
    });
  }
  return out;
}

export default function MarketsPanel({
  groups,
  odds,
  setOdd,
  quality,
  settings,
  bankroll,
  onBet,
}: {
  groups: GroupDef[];
  odds: OddsMap;
  setOdd: (key: string, v: string) => void;
  quality: Quality;
  settings: Settings;
  bankroll: number;
  onBet: (d: BetDraft) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const parsed = g.outcomes.map((o) => parseOdds(odds[o.key]));
        const fp = g.overlap ? null : fairProbs(parsed);
        return (
          <div key={g.id} className="card-pad">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-sm font-semibold">{g.title}</h3>
              {g.control}
            </div>
            {g.note && <p className="hint mb-1">{g.note}</p>}
            {fp ? (
              <p className="mb-1 text-xs text-muted">
                Bookmaker margin <span className="num text-foreground">{(fp.margin * 100).toFixed(1)}%</span>.
                Market % below have the margin removed.
              </p>
            ) : g.overlap ? (
              <p className="mb-1 text-xs text-muted">
                These outcomes overlap, so each price is checked on its own.
              </p>
            ) : (
              <p className="mb-1 text-xs text-muted">
                Enter odds for {g.outcomes.length === 2 ? "both" : "all"} outcomes to see the
                market&apos;s fair probability and your edge.
              </p>
            )}

            <div>
              {g.outcomes.map((o, i) => {
                const od = parsed[i];
                const fair = fp?.fair[i];
                const ev = od ? expectedValue(o.prob, od) : null;
                const evLow = od ? expectedValue(o.range[0], od) : null;
                const verdict =
                  ev !== null && evLow !== null
                    ? verdictFor(ev, evLow, quality, settings.evThreshold)
                    : null;
                const suggested = od ? suggestStake(bankroll, o.range[0], od, settings.kellyFraction, settings.maxStakePct) : 0;
                const invalid = !!odds[o.key] && !od;
                return (
                  <div
                    key={o.key}
                    className="border-t py-3.5 first:border-t-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{o.label}</div>
                        <div className="num text-[13px] text-muted">
                          Model <span className="text-base font-semibold text-foreground">{pct(o.prob)}</span>{" "}
                          · range {(o.range[0] * 100).toFixed(0)}–{pct(o.range[1])}
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <input
                          className="input num text-right"
                          inputMode="decimal"
                          placeholder="Odds"
                          aria-label={`Bookmaker odds for ${o.label} in ${g.title}`}
                          aria-invalid={invalid}
                          value={odds[o.key] ?? ""}
                          onChange={(e) => setOdd(o.key, e.target.value)}
                        />
                      </div>
                    </div>
                    <RangeBar range={o.range} model={o.prob} market={fair} />
                    {invalid && (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        Use decimal odds like 2.10 (or fractional like 5/2).
                      </p>
                    )}
                    {od && verdict && ev !== null && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
                        <Badge tone={TONE[verdict]}>{VERDICT_LABEL[verdict]}</Badge>
                        {fair !== undefined && (
                          <span className="num text-muted">
                            Market {pct(fair, 1)} · edge{" "}
                            <span className={o.prob - fair > 0 ? "text-emerald-400" : "text-danger"}>
                              {signedPct(o.prob - fair)}
                            </span>
                          </span>
                        )}
                        <span className="num text-muted">
                          EV{" "}
                          <span className={ev > 0 ? "text-emerald-400" : "text-danger"}>{signedPct(ev)}</span>
                        </span>
                        <span className="num text-muted">
                          {suggested > 0
                            ? `Stake ≈ ${money(suggested, settings.currency)}`
                            : "No stake suggested"}
                        </span>
                        <button
                          className="btn-secondary btn-sm ml-auto"
                          onClick={() =>
                            onBet({
                              key: o.key,
                              groupTitle: g.title,
                              selection: o.label,
                              odds: od,
                              prob: o.prob,
                              fair,
                              suggested,
                            })
                          }
                        >
                          Paper bet
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-muted">
        <span className="num">EV</span> is the average return per 1 staked if the model were exactly
        right. The suggested stake uses the cautious end of the range, a fraction of Kelly (
        {settings.kellyFraction}×) and a cap of {settings.maxStakePct}% of bankroll. White tick = model,
        green band = realistic range, amber diamond = market&apos;s fair price.
      </p>
    </div>
  );
}
