"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Modal } from "@/components/ui";
import { toast } from "@/components/Toaster";
import { clearSlip, placeSlip, removeFromSlip, setLegOdds, slipOdds, useAppState } from "@/lib/store";
import { Leg } from "@/lib/types";
import { bankrollOf } from "@/lib/stats";
import { money } from "@/lib/format";

const QUICK = [10, 25, 50, 100];

/** Quarter-Kelly on the whole slip, capped at 2% of bankroll; a small 1% tracking stake when there's no edge. */
export function suggestedStake(bankroll: number, chance: number, odds: number) {
  if (bankroll <= 0 || odds <= 1) return 0;
  const ev = chance * odds - 1;
  const f = ev > 0 ? Math.min(0.02, (0.25 * ev) / (odds - 1)) : 0.01;
  return Math.max(1, Math.round(bankroll * f));
}

function OddsInput({ leg }: { leg: Leg }) {
  const [text, setText] = useState(leg.odds.toFixed(2));
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (isFinite(n) && n > 1.01 && n < 1000) setLegOdds(leg.id, Math.round(n * 100) / 100);
    else setText(leg.odds.toFixed(2));
  };
  return (
    <input
      className={`input num !min-h-9 w-[4.5rem] px-2 text-right !text-[16px] font-semibold ${leg.priced === false ? "!border-amber-400/60" : ""}`}
      inputMode="decimal"
      enterKeyHint="done"
      aria-label={`Your odds for ${leg.selection}${leg.priced === false ? " (estimated, enter Betway's price)" : ""}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export default function SlipBar() {
  const state = useAppState();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [stakeText, setStakeText] = useState("20");
  const legs = state.slip ?? [];
  const cur = state.settings.currency;

  if (!legs.length || path.startsWith("/bets")) return null;

  const odds = slipOdds(legs);
  const chance = legs.reduce((a, l) => a * l.prob, 1);
  const ev = chance * odds - 1;
  const stake = Number(stakeText.replace(",", "."));
  const { balance } = bankrollOf(state);
  const suggested = suggestedStake(balance, chance, odds);
  const estimated = legs.filter((l) => l.priced === false).length;
  const validStake = isFinite(stake) && stake > 0 && stake <= balance;

  const place = () => {
    if (!validStake) return;
    placeSlip(Math.round(stake * 100) / 100);
    setOpen(false);
    toast("Bet placed. Track it here.");
    router.push("/bets");
  };

  return (
    <>
      <div className="slip-dock">
        <button type="button" className="slip-bar" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span className="flex items-center gap-2.5">
            <span className="slip-count num">{legs.length}</span>
            <span className="text-[14px] font-semibold">Bet slip</span>
          </span>
          <span className="num text-[15px] font-semibold">
            <span className="mr-1 text-[12px] font-medium opacity-70">Odds</span>
            {odds.toFixed(2)}
          </span>
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={legs.length === 1 ? "Single" : `${legs.length}-fold accumulator`}>
        <ul className="-mt-1 divide-y" style={{ borderColor: "var(--border)" }}>
          {legs.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{l.selection}</div>
                <div className="truncate text-[12px] text-muted">
                  {l.home} v {l.away}
                </div>
                <div className="num text-[12px] text-muted">
                  {(l.prob * 100).toFixed(0)}% · fair {(1 / l.prob).toFixed(2)}
                  {l.prob * l.odds - 1 >= 0.02 && <span className="value-tag ml-1.5 align-middle">Value</span>}
                </div>
              </div>
              <OddsInput key={l.odds} leg={l} />
              <button
                className="btn-ghost btn-sm !min-h-9 !px-2"
                aria-label={`Remove ${l.selection}`}
                onClick={() => removeFromSlip(l.id)}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {estimated > 0 && (
          <p className="mt-2 rounded-lg px-3 py-2 text-[12px] text-amber-200" style={{ background: "rgba(251,191,36,0.1)" }}>
            {estimated} {estimated === 1 ? "price is" : "prices are"} estimated (amber). Tap and type Betway&apos;s price so the numbers are real.
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Total odds</div>
            <div className="num text-lg font-semibold">{odds.toFixed(2)}</div>
          </div>
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Chance all win</div>
            <div className="num text-lg font-semibold">{(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%</div>
          </div>
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Expected value</div>
            <div className={`num text-lg font-semibold ${ev >= 0 ? "text-emerald-400" : "text-danger"}`}>
              {ev >= 0 ? "+" : "−"}
              {Math.abs(ev * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <p className="hint">
          {ev >= 0
            ? `On average this slip returns ${money(100 * (1 + ev), cur)} per ${money(100, cur)} staked, if the estimates are right.`
            : `The bookmaker has about a ${Math.abs(ev * 100).toFixed(0)}% edge on this slip. Each leg's margin multiplies.`}
        </p>

        <label className="label mt-4" htmlFor="stake">
          Stake ({cur})
        </label>
        <input
          id="stake"
          className="input num text-[16px]"
          inputMode="decimal"
          value={stakeText}
          onChange={(e) => setStakeText(e.target.value)}
          aria-invalid={!validStake}
          aria-describedby="stake-hint"
        />
        <div className="mt-2 flex gap-2">
          {suggested > 0 && (
            <button
              className="chip num flex-1 justify-center !border-emerald-400/60 !text-emerald-200"
              aria-pressed={stake === suggested}
              aria-label={`Suggested stake ${suggested}`}
              onClick={() => setStakeText(String(suggested))}
            >
              ★ {suggested}
            </button>
          )}
          {QUICK.filter((q) => q !== suggested).slice(0, 3).map((q) => (
            <button key={q} className="chip num flex-1 justify-center" aria-pressed={stake === q} onClick={() => setStakeText(String(q))}>
              {q}
            </button>
          ))}
        </div>
        {suggested > 0 && (
          <p className="hint">
            ★ Suggested {money(suggested, cur)}: {ev > 0 ? "quarter-Kelly, capped at 2% of your bankroll" : "no edge, so just a small 1% tracking stake"}.
          </p>
        )}
        <p id="stake-hint" className={`hint ${validStake ? "" : "!text-danger"}`}>
          {validStake
            ? `Returns ${money(stake * odds, cur)} · paper bankroll ${money(balance, cur)}`
            : stake > balance
            ? `More than your paper bankroll (${money(balance, cur)}).`
            : "Enter a stake above 0."}
        </p>

        <button className="btn-primary mt-4 w-full !min-h-12 text-[15px]" disabled={!validStake} onClick={place}>
          Place bet · {validStake ? money(stake, cur) : "–"}
        </button>
        <button
          className="btn-ghost mt-1 w-full"
          onClick={() => {
            clearSlip();
            setOpen(false);
          }}
        >
          Clear slip
        </button>
      </Modal>
    </>
  );
}
