"use client";

import { FootballInputs, SquadAdj } from "@/lib/types";
import { DecimalInput, Field } from "@/components/ui";
import FormTable from "./FormTable";

function AdjSelects({
  team,
  adj,
  onChange,
}: {
  team: string;
  adj: SquadAdj;
  onChange: (a: SquadAdj) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${team}: attackers`}>
        {(id) => (
          <select
            id={id}
            className="input"
            value={adj.attack}
            onChange={(e) => onChange({ ...adj, attack: Number(e.target.value) })}
          >
            <option value={0}>Full strength</option>
            <option value={-8}>Key attacker out (−8%)</option>
            <option value={-15}>Several attackers out (−15%)</option>
            <option value={5}>Boost: key player back (+5%)</option>
          </select>
        )}
      </Field>
      <Field label={`${team}: defence & keeper`}>
        {(id) => (
          <select
            id={id}
            className="input"
            value={adj.defence}
            onChange={(e) => onChange({ ...adj, defence: Number(e.target.value) })}
          >
            <option value={0}>Full strength</option>
            <option value={8}>Key defender/keeper out (+8% conceded)</option>
            <option value={15}>Several out (+15% conceded)</option>
            <option value={-5}>Boost: key player back (−5% conceded)</option>
          </select>
        )}
      </Field>
    </div>
  );
}

export default function FootballForm({
  value,
  onChange,
}: {
  value: FootballInputs;
  onChange: (v: FootballInputs) => void;
}) {
  const set = <K extends keyof FootballInputs>(k: K, v: FootballInputs[K]) => onChange({ ...value, [k]: v });
  const hn = value.home.trim() || "Home team";
  const an = value.away.trim() || "Away team";

  return (
    <div className="space-y-4">
      <div className="card-pad space-y-4">
        <h2 className="h-section">1 · The match</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Home team">
            {(id) => (
              <input
                id={id}
                className="input"
                placeholder="e.g. Arsenal"
                value={value.home}
                onChange={(e) => set("home", e.target.value)}
              />
            )}
          </Field>
          <Field label="Away team">
            {(id) => (
              <input
                id={id}
                className="input"
                placeholder="e.g. Chelsea"
                value={value.away}
                onChange={(e) => set("away", e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Competition (optional)">
          {(id) => (
            <input
              id={id}
              className="input"
              placeholder="e.g. Premier League"
              value={value.league}
              onChange={(e) => set("league", e.target.value)}
            />
          )}
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#22c55e]"
            checked={value.neutral}
            onChange={(e) => set("neutral", e.target.checked)}
          />
          Neutral venue (no home advantage)
        </label>
      </div>

      <div className="card-pad space-y-6">
        <h2 className="h-section">2 · Recent form</h2>
        <FormTable teamLabel={hn} rows={value.homeForm} onChange={(r) => set("homeForm", r)} />
        <div className="border-t" style={{ borderColor: "var(--border)" }} />
        <FormTable teamLabel={an} rows={value.awayForm} onChange={(r) => set("awayForm", r)} />
        <p className="hint">
          Use league matches from the last 2–3 months. &quot;Opponent&quot; is the other side&apos;s
          standing: top (title/European places), mid, or low. It stops a hot streak against weak teams
          from being over-rated.
        </p>
      </div>

      <details className="card-pad group">
        <summary className="h-section flex min-h-9 list-none items-center justify-between">
          <span>3 · Squad news &amp; league settings</span>
          <span className="text-xs normal-case text-muted group-open:hidden">Optional</span>
        </summary>
        <div className="mt-4 space-y-5">
          <AdjSelects team={hn} adj={value.homeAdj} onChange={(a) => set("homeAdj", a)} />
          <AdjSelects team={an} adj={value.awayAdj} onChange={(a) => set("awayAdj", a)} />
          <p className="hint">
            These are judgement calls, not facts. Check confirmed line-ups close to kick-off and keep
            changes modest.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="League avg goals per match" hint="Most top leagues sit between 2.4 and 3.0.">
              {(id, d) => (
                <DecimalInput id={id} describedBy={d} value={value.leagueGoals} onValue={(n) => set("leagueGoals", n)} />
              )}
            </Field>
            <Field label="Home advantage ratio" hint="Home goals ÷ away goals in this league. About 1.2–1.3.">
              {(id, d) => (
                <DecimalInput id={id} describedBy={d} value={value.homeAdv} onValue={(n) => set("homeAdv", n)} />
              )}
            </Field>
          </div>
        </div>
      </details>
    </div>
  );
}
