"use client";

import { Check, Plus } from "lucide-react";
import { addToSlip } from "@/lib/store";
import { Pick } from "@/lib/research/engine";
import { GROUP_LABEL } from "@/lib/research/markets";
import { Fixture } from "@/lib/research/data";
import { toast } from "@/components/Toaster";

export function legFrom(p: Pick, f: Fixture) {
  return {
    fixtureId: f.id,
    home: f.home,
    away: f.away,
    league: `${f.league.name} · ${f.league.country}`,
    kickoff: f.kickoff,
    group: GROUP_LABEL[p.group],
    key: p.key,
    selection: p.label,
    odds: p.odds,
    prob: p.prob,
    modelProb: p.modelProb,
  };
}

/** The odds button doubles as "Add to bet". Tapping it again removes the pick. */
export default function PickButton({
  pick,
  fixture,
  active,
  compact = false,
}: {
  pick: Pick;
  fixture: Fixture;
  active: boolean;
  compact?: boolean;
}) {
  const onClick = () => {
    const r = addToSlip(legFrom(pick, fixture));
    if (r === "replaced") toast(`Swapped your pick on ${fixture.home} v ${fixture.away}. One pick per match; use a combo to mix.`);
    else if (r === "removed") toast("Removed from slip");
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${active ? "Remove" : "Add"} ${pick.label} at ${pick.odds.toFixed(2)} ${active ? "from" : "to"} bet slip`}
      className={`odds-btn ${compact ? "min-w-[4.25rem] !min-h-10" : "min-w-[4.75rem]"}`}
    >
      <span className="num text-[14px] font-semibold">{pick.odds.toFixed(2)}</span>
      {active ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Plus size={14} strokeWidth={2.5} aria-hidden />}
    </button>
  );
}
