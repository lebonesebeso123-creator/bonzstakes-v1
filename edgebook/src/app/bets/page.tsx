"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Trash2, Undo2 } from "lucide-react";
import { Badge, EmptyState, Stat, Tabs } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { toast } from "@/components/Toaster";
import { deleteBet, patchBet, settleBet, useAppState } from "@/lib/store";
import { bankrollOf, bankrollSeries, betProfit, breakdown, maxDrawdown, summarise } from "@/lib/stats";
import { dateShort, money, pct, signedPct } from "@/lib/format";
import { parseOdds } from "@/lib/odds";
import { Bet } from "@/lib/types";
import { LearningCard, LegList, ResultChecker } from "@/components/research/BetLegs";

type Tab = "open" | "history" | "performance";


function BetCard({ bet, currency }: { bet: Bet; currency: string }) {
  const profit = betProfit(bet);
  const [closing, setClosing] = useState(bet.closingOdds ? String(bet.closingOdds) : "");
  const tone = bet.status === "won" ? "green" : bet.status === "lost" ? "red" : bet.status === "void" ? "neutral" : "blue";

  const saveClosing = () => {
    const v = parseOdds(closing);
    if (closing.trim() === "") patchBet(bet.id, { closingOdds: undefined });
    else if (v) patchBet(bet.id, { closingOdds: v });
  };

  return (
    <li className="card-pad">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{bet.status === "open" ? "Open" : bet.status}</Badge>
            <span className="text-xs text-muted">
              {dateShort(bet.placedAt)}
            </span>
          </div>
          <h2 className="mt-1.5 truncate font-medium">{bet.matchLabel}</h2>
          <p className="text-sm text-muted">
            {bet.selection} · {bet.market}
          </p>
        </div>
        <div className="num shrink-0 text-right">
          <div className="text-lg font-semibold">@ {bet.odds.toFixed(2)}</div>
          <div className="text-xs text-muted">Stake {money(bet.stake, currency)}</div>
          {bet.status === "open" ? (
            <div className="text-xs text-muted">Returns {money(bet.stake * bet.odds, currency)}</div>
          ) : (
            <div className={`text-sm font-semibold ${profit > 0 ? "text-emerald-400" : profit < 0 ? "text-danger" : "text-muted"}`}>
              {money(profit, currency, true)}
            </div>
          )}
        </div>
      </div>

      {bet.legs && bet.legs.length > 1 && <LegList legs={bet.legs} />}
      {bet.legs && bet.legs.length === 1 && bet.legs[0].result && <LegList legs={bet.legs} />}

      {(bet.modelProb !== undefined || bet.note) && (
        <p className="num mt-2 text-xs text-muted">
          {bet.modelProb !== undefined && (
            <>
              {bet.legs ? "Estimated chance" : "Model"} {pct(bet.modelProb, bet.modelProb < 0.1 ? 1 : 0)}
              {bet.fairProb !== undefined && <> · market {pct(bet.fairProb)}</>}
            </>
          )}
          {bet.note && <span className="font-sans"> {bet.modelProb !== undefined ? "· " : ""}{bet.note}</span>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {bet.status === "open" && bet.legs ? (
          <span className="text-xs text-muted">Settles automatically when results are in</span>
        ) : bet.status === "open" ? (
          <>
            <button className="btn-primary btn-sm" onClick={() => { settleBet(bet.id, "won"); toast("Marked as won"); }}>
              Won
            </button>
            <button className="btn-secondary btn-sm" onClick={() => { settleBet(bet.id, "lost"); toast("Marked as lost"); }}>
              Lost
            </button>
            <button className="btn-ghost btn-sm" onClick={() => { settleBet(bet.id, "void"); toast("Marked as void, stake returned"); }}>
              Void
            </button>
          </>
        ) : bet.legs ? null : (
          <button className="btn-secondary btn-sm" onClick={() => settleBet(bet.id, "open")}>
            <Undo2 size={14} aria-hidden /> Reopen
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Closing odds
          <input
            className="input num !min-h-9 w-20 px-2 text-right text-[13px]"
            inputMode="decimal"
            placeholder="–"
            aria-label="Closing odds for this bet"
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            onBlur={saveClosing}
          />
        </label>
        <button
          className="btn-ghost btn-sm !px-2"
          aria-label={`Delete bet on ${bet.selection}`}
          onClick={() => window.confirm("Delete this bet? This can't be undone.") && deleteBet(bet.id)}
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
    </li>
  );
}

function Table({ title, rows, cur }: { title: string; rows: ReturnType<typeof breakdown>; cur: string }) {
  return (
  <div className="card-pad overflow-x-auto">
    <h2 className="mb-2 font-display text-[16px] font-bold">{title}</h2>
    <table className="num w-full min-w-[320px] text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1.5 font-medium">&nbsp;</th>
          <th className="py-1.5 pl-3 text-right font-medium">Bets</th>
          <th className="py-1.5 pl-3 text-right font-medium">Won</th>
          <th className="py-1.5 pl-3 text-right font-medium">Profit</th>
          <th className="py-1.5 pl-3 text-right font-medium">ROI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t" style={{ borderColor: "var(--border)" }}>
            <td className="max-w-[10rem] truncate py-2 font-sans">{r.key}</td>
            <td className="py-2 text-right">{r.n}</td>
            <td className="py-2 text-right">{r.won}</td>
            <td className={`py-2 text-right ${r.profit >= 0 ? "text-emerald-400" : "text-danger"}`}>{money(r.profit, cur, true)}</td>
            <td className={`py-2 text-right ${r.roi >= 0 ? "text-emerald-400" : "text-danger"}`}>{signedPct(r.roi)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
}

function Performance() {
  const state = useAppState();
  const cur = state.settings.currency;
  const sum = useMemo(() => summarise(state.bets), [state.bets]);
  const series = useMemo(() => bankrollSeries(state), [state]);
  const dd = maxDrawdown(series);
  const byMarket = useMemo(() => breakdown(state.bets, "market"), [state.bets]);

  if (sum.settled === 0)
    return (
      <div className="space-y-4">
      <LearningCard />
      <EmptyState
        icon={<Receipt size={28} />}
        title="Nothing to measure yet"
        body="Settle a few paper bets and your bankroll curve, ROI and model scorecard will build up here."
      />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <h2 className="mb-3 font-display text-[16px] font-bold">Bankroll over time</h2>
        {series.length >= 2 ? (
          <LineChart data={series} format={(n) => money(n, cur)} />
        ) : (
          <p className="text-sm text-muted">Settle a bet to start the curve.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Settled bets" value={sum.priced} sub={`${sum.won} won · ${sum.lost} lost${sum.voids ? ` · ${sum.voids} void` : ""}`} />
        <Stat label="Win rate" value={sum.winRate !== null ? pct(sum.winRate) : "–"} sub={sum.avgOdds ? `Avg odds ${sum.avgOdds.toFixed(2)}` : undefined} />
        <Stat label="Max drawdown" value={pct(dd)} sub="Peak-to-trough" />
        <Stat label="Streaks" value={`${sum.maxWinStreak}W · ${sum.maxLossStreak}L`} sub="Longest runs" />
      </div>

      <LearningCard />

      <div className="card-pad">
        <h2 className="mb-1 font-display text-[16px] font-bold">Did you beat the closing line?</h2>
        {sum.avgClv !== null ? (
          <p className="text-sm">
            Average closing-line value:{" "}
            <span className={`num font-semibold ${sum.avgClv >= 0 ? "text-emerald-400" : "text-danger"}`}>{signedPct(sum.avgClv)}</span>{" "}
            <span className="text-muted">across {sum.clvCount} bets with closing odds. Consistently positive is a good sign; it&apos;s a stronger signal than short-term profit.</span>
          </p>
        ) : (
          <p className="text-sm text-muted">Add closing odds (the price just before kick-off) to your bets to measure this.</p>
        )}
      </div>

      {byMarket.length > 0 && <Table title="By market" rows={byMarket} cur={cur} />}
    </div>
  );
}

export default function BetsPage() {
  const state = useAppState();
  const cur = state.settings.currency;
  const [tab, setTab] = useState<Tab>("open");
  const [resultF, setResultF] = useState<"all" | "won" | "lost" | "void">("all");

  const br = bankrollOf(state);
  const sum = summarise(state.bets);
  const open = state.bets.filter((b) => b.status === "open");
  const history = state.bets
    .filter((b) => b.status !== "open")
    .filter((b) => resultF === "all" || b.status === resultF)
    .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
  const historyAll = state.bets.filter((b) => b.status !== "open").length;

  return (
    <div>
      <h1 className="h-page">Bets</h1>
      <p className="mt-1 mb-5 text-sm text-muted">Virtual stakes only. Track your decisions honestly and let the numbers speak.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Available" value={money(br.balance, cur)} />
        <Stat label="In play" value={money(br.openStake, cur)} sub={`${open.length} open`} />
        <Stat label="Profit / loss" value={money(br.profit, cur, true)} tone={br.profit > 0 ? "pos" : br.profit < 0 ? "neg" : undefined} />
        <Stat label="ROI" value={sum.roi !== null ? signedPct(sum.roi) : "–"} sub="Profit ÷ staked" tone={sum.roi ? (sum.roi > 0 ? "pos" : "neg") : undefined} />
      </div>

      <Tabs<Tab>
        label="Bets"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Open", count: open.length },
          { value: "history", label: "History", count: historyAll },
          { value: "performance", label: "Performance" },
        ]}
      />

      {tab === "open" && <ResultChecker />}
      {tab === "open" &&
        (open.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="No open bets"
            body="Research the weekend’s matches, add picks to your slip and place a paper bet."
            action={<Link href="/" className="btn-primary">Research matches</Link>}
          />
        ) : (
          <ul className="space-y-3">
            {open.map((b) => (
              <BetCard key={b.id} bet={b} currency={cur} />
            ))}
          </ul>
        ))}

      {tab === "history" &&
        (historyAll === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="No settled bets yet" body="Settle an open bet as won, lost or void and it will appear here." />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              <label className="text-xs text-muted">
                <span className="mb-1 block">Result</span>
                <select className="input w-auto" value={resultF} onChange={(e) => setResultF(e.target.value as typeof resultF)}>
                  <option value="all">All results</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="void">Void</option>
                </select>
              </label>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted">No bets match these filters.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((b) => (
                  <BetCard key={b.id} bet={b} currency={cur} />
                ))}
              </ul>
            )}
          </>
        ))}

      {tab === "performance" && <Performance />}
    </div>
  );
}
