"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Modal } from "@/components/ui";
import { toast } from "@/components/Toaster";
import { clearSlip, placeSlip, removeFromSlip, slipOdds, useAppState } from "@/lib/store";
import { bankrollOf } from "@/lib/stats";
import { money } from "@/lib/format";

const QUICK = [10, 25, 50, 100];

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
  const stake = Number(stakeText.replace(",", "."));
  const { balance } = bankrollOf(state);
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
                  {l.home} v {l.away} · {(l.prob * 100).toFixed(0)}%
                </div>
              </div>
              <span className="num text-[14px] font-semibold">{l.odds.toFixed(2)}</span>
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

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Total odds</div>
            <div className="num text-lg font-semibold">{odds.toFixed(2)}</div>
          </div>
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Chance all win</div>
            <div className="num text-lg font-semibold">{(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%</div>
          </div>
        </div>

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
          {QUICK.map((q) => (
            <button key={q} className="chip num flex-1 justify-center" aria-pressed={stake === q} onClick={() => setStakeText(String(q))}>
              {q}
            </button>
          ))}
        </div>
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
