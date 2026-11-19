"use client";

import { BasketballInputs } from "@/lib/types";
import { DecimalInput, Field } from "@/components/ui";

function TeamBlock({
  name,
  games,
  pf,
  pa,
  onGames,
  onPf,
  onPa,
}: {
  name: string;
  games: string;
  pf: string;
  pa: string;
  onGames: (v: string) => void;
  onPf: (v: string) => void;
  onPa: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold">{name}: recent averages</legend>
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Games">
          {(id) => (
            <input id={id} className="input num" inputMode="numeric" placeholder="10" value={games} onChange={(e) => onGames(e.target.value.replace(/\D/g, ""))} />
          )}
        </Field>
        <Field label="Pts scored">
          {(id) => (
            <input id={id} className="input num" inputMode="decimal" placeholder="112.4" value={pf} onChange={(e) => onPf(e.target.value)} />
          )}
        </Field>
        <Field label="Pts allowed">
          {(id) => (
            <input id={id} className="input num" inputMode="decimal" placeholder="108.1" value={pa} onChange={(e) => onPa(e.target.value)} />
          )}
        </Field>
      </div>
    </fieldset>
  );
}

export default function BasketballForm({
  value,
  onChange,
}: {
  value: BasketballInputs;
  onChange: (v: BasketballInputs) => void;
}) {
  const set = <K extends keyof BasketballInputs>(k: K, v: BasketballInputs[K]) => onChange({ ...value, [k]: v });
  const hn = value.home.trim() || "Home team";
  const an = value.away.trim() || "Away team";

  return (
    <div className="space-y-4">
      <div className="card-pad space-y-4">
        <h2 className="h-section">1 · The game</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Home team">
            {(id) => <input id={id} className="input" placeholder="e.g. Celtics" value={value.home} onChange={(e) => set("home", e.target.value)} />}
          </Field>
          <Field label="Away team">
            {(id) => <input id={id} className="input" placeholder="e.g. Knicks" value={value.away} onChange={(e) => set("away", e.target.value)} />}
          </Field>
        </div>
        <Field label="Competition (optional)">
          {(id) => <input id={id} className="input" placeholder="e.g. NBA" value={value.league} onChange={(e) => set("league", e.target.value)} />}
        </Field>
      </div>

      <div className="card-pad space-y-5">
        <h2 className="h-section">2 · Recent scoring</h2>
        <TeamBlock
          name={hn}
          games={value.homeGames}
          pf={value.homeFor}
          pa={value.homeAgainst}
          onGames={(v) => set("homeGames", v)}
          onPf={(v) => set("homeFor", v)}
          onPa={(v) => set("homeAgainst", v)}
        />
        <div className="border-t" style={{ borderColor: "var(--border)" }} />
        <TeamBlock
          name={an}
          games={value.awayGames}
          pf={value.awayFor}
          pa={value.awayAgainst}
          onGames={(v) => set("awayGames", v)}
          onPf={(v) => set("awayFor", v)}
          onPa={(v) => set("awayAgainst", v)}
        />
        <p className="hint">Average points per game over the last 5–15 games. Fewer games are pulled toward the league average.</p>
      </div>

      <div className="card-pad space-y-4">
        <h2 className="h-section">3 · Bookmaker lines (optional)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Home spread" hint="e.g. −5.5 if home are favourites, +3.5 if underdogs.">
            {(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" placeholder="-5.5" value={value.spreadLine} onChange={(e) => set("spreadLine", e.target.value.replace(",", "."))} />}
          </Field>
          <Field label="Total points line" hint="e.g. 226.5">
            {(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" placeholder="226.5" value={value.totalLine} onChange={(e) => set("totalLine", e.target.value.replace(",", "."))} />}
          </Field>
        </div>
      </div>

      <details className="card-pad group">
        <summary className="h-section flex min-h-9 list-none items-center justify-between">
          <span>4 · League settings</span>
          <span className="text-xs normal-case text-muted group-open:hidden">Optional</span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="League avg points per team" hint="NBA ≈ 114. EuroLeague ≈ 82.">
            {(id, d) => <DecimalInput id={id} describedBy={d} value={value.leaguePoints} onValue={(n) => set("leaguePoints", n)} />}
          </Field>
          <Field label="Home-court advantage (pts)" hint="Usually 2–3 points.">
            {(id, d) => <DecimalInput id={id} describedBy={d} value={value.homeCourt} onValue={(n) => set("homeCourt", n)} />}
          </Field>
          <Field label="Margin spread (SD)" hint="How much results vary. About 12.">
            {(id, d) => <DecimalInput id={id} describedBy={d} value={value.sdMargin} onValue={(n) => set("sdMargin", Math.max(4, n))} />}
          </Field>
          <Field label="Total spread (SD)" hint="About 17–19.">
            {(id, d) => <DecimalInput id={id} describedBy={d} value={value.sdTotal} onValue={(n) => set("sdTotal", Math.max(4, n))} />}
          </Field>
        </div>
      </details>
    </div>
  );
}
