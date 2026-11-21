"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Database, RefreshCw, Search, Wifi } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/components/ui";
import MatchCard from "@/components/research/MatchCard";
import { SlipBuilder, Suggestions } from "@/components/research/Suggestions";
import { useAppState, useHydrated } from "@/lib/store";
import { getProvider } from "@/lib/research/provider";
import {
  AnalysedMatch,
  LeagueGroup,
  TIME_FRAMES,
  TimeFrame,
  analyseFixture,
  groupByLeague,
  leagueGoalAverages,
  learningFrom,
  rangeFor,
} from "@/lib/research/engine";
import { MARKET_GROUPS, MarketGroup } from "@/lib/research/markets";

type View = "matches" | "picks" | "builder";

interface RunResult {
  matches: AnalysedMatch[];
  leagues: LeagueGroup[];
  tf: TimeFrame;
  at: number;
  demo: boolean;
  oddsUpdated?: string;
  priced: number;
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
}

/* Kept outside React so results survive moving between pages. */
let lastRun: RunResult | null = null;
let lastFilters: { tf: TimeFrame; groups: MarketGroup[] } = { tf: "weekend", groups: ["1x2", "btts", "goals", "corners"] };

const tick = () => new Promise((r) => setTimeout(r, 0));

type Sort = "kickoff" | "likely" | "value";

const topProb = (m: AnalysedMatch) => Math.max(0, ...m.best.map((p) => p.prob));
const topEdge = (m: AnalysedMatch) => Math.max(-1, ...m.options.filter((o) => o.prob >= 0.35).map((p) => p.edge ?? -1));

function MatchesView({ leagues, slip }: { leagues: LeagueGroup[]; slip: Map<string, string> }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("kickoff");
  const [valueOnly, setValueOnly] = useState(false);
  const q = query.trim().toLowerCase();
  const filtering = q !== "" || valueOnly;

  const shown = useMemo(() => {
    const out: LeagueGroup[] = [];
    for (const g of leagues) {
      const leagueHit = q !== "" && `${g.name} ${g.country}`.toLowerCase().includes(q);
      let ms = g.matches.filter(
        (m) =>
          (q === "" || leagueHit || `${m.fixture.home} ${m.fixture.away}`.toLowerCase().includes(q)) &&
          (!valueOnly || topEdge(m) >= 0.02)
      );
      if (sort === "likely") ms = [...ms].sort((a, b) => topProb(b) - topProb(a));
      if (sort === "value") ms = [...ms].sort((a, b) => topEdge(b) - topEdge(a));
      if (ms.length) out.push({ ...g, matches: ms });
    }
    return out;
  }, [leagues, q, sort, valueOnly]);

  const count = shown.reduce((a, g) => a + g.matches.length, 0);

  return (
    <div>
      <div className="mb-4 space-y-2.5">
        <div className="relative">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="input !pl-9"
            placeholder="Search a team or league"
            aria-label="Search a team or league"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="scroll-row !mx-0 !px-0 !pb-0" role="group" aria-label="Sort matches">
            {(
              [
                ["kickoff", "Kick-off"],
                ["likely", "Most likely"],
                ["value", "Best value"],
              ] as [Sort, string][]
            ).map(([v, l]) => (
              <button key={v} className="chip shrink-0" aria-pressed={sort === v} onClick={() => setSort(v)}>
                {l}
              </button>
            ))}
          </div>
          <button className="chip shrink-0" aria-pressed={valueOnly} onClick={() => setValueOnly((v) => !v)}>
            Value only
          </button>
        </div>
        {filtering && (
          <p className="num text-[12px] text-muted" aria-live="polite">
            {count} {count === 1 ? "match" : "matches"} found
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card-pad text-center text-sm text-muted">Nothing matches. Clear the search or turn off Value only.</div>
      ) : (
        <div className="space-y-5">
          {shown.map((g, idx) => (
            <League key={g.key + (filtering ? ":f" : "")} g={g} slip={slip} defaultOpen={filtering || idx < 3} />
          ))}
        </div>
      )}
    </div>
  );
}

function League({ g, slip, defaultOpen }: { g: LeagueGroup; slip: Map<string, string>; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label={`${g.name}, ${g.country}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="league-head"
      >
        <span className="min-w-0 text-left">
          <span className="block truncate text-[15px] font-semibold">{g.name}</span>
          <span className="text-[12px] text-muted">{g.country}</span>
        </span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="num">{g.matches.length} {g.matches.length === 1 ? "match" : "matches"}</span>
          <ChevronDown size={16} aria-hidden className="chev" data-open={open} />
        </span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {g.matches.map((m) => (
            <MatchCard key={m.fixture.id} m={m} slipKey={slip.get(m.fixture.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ResearchPage() {
  const hydrated = useHydrated();
  const state = useAppState();
  const [tf, setTf] = useState<TimeFrame>(lastFilters.tf);
  const [groups, setGroups] = useState<MarketGroup[]>(lastFilters.groups);
  const [result, setResult] = useState<RunResult | null>(lastRun);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [view, setView] = useState<View>("matches");
  const [editing, setEditing] = useState(!lastRun);

  const slip = useMemo(() => new Map((state.slip ?? []).map((l) => [l.fixtureId, l.key])), [state.slip]);
  const learning = useMemo(() => learningFrom(state.bets, state.learningSince), [state.bets, state.learningSince]);
  const learned = useMemo(() => Object.values(learning).reduce((a, s) => a + s.n, 0), [learning]);
  const provider = getProvider(state.settings.dataUrl);
  const [error, setError] = useState<string | null>(null);

  const toggle = (g: MarketGroup) =>
    setGroups((cur) => (cur.includes(g) ? (cur.length > 1 ? cur.filter((x) => x !== g) : cur) : [...cur, g]));

  async function run() {
    const started = performance.now();
    lastFilters = { tf, groups };
    setError(null);
    if (typeof navigator !== "undefined" && !navigator.onLine && !provider.isDemo) {
      setError("You're offline. Connect to the internet to load live matches.");
      return;
    }
    setProgress({ label: "Finding fixtures", pct: 5 });
    const { from, to } = rangeFor(tf);
    let fixtures;
    try {
      fixtures = await provider.getFixtures(from, to);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : "Couldn't load matches.");
      return;
    }
    const avg = leagueGoalAverages(fixtures);
    const byLeague = new Map<string, typeof fixtures>();
    fixtures.forEach((f) => byLeague.set(f.league.id, [...(byLeague.get(f.league.id) ?? []), f]));
    const matches: AnalysedMatch[] = [];
    let i = 0;
    for (const [, list] of byLeague) {
      setProgress({ label: `Analysing ${list[0].league.name} · ${list[0].league.country}`, pct: 10 + (80 * i++) / byLeague.size });
      await tick();
      for (const f of list) {
        if (f.status === "POSTPONED" || f.status === "CANCELLED") continue;
        const m = analyseFixture(f, groups, learning, avg[f.league.id]);
        if (m) matches.push(m);
      }
    }
    setProgress({ label: "Ranking picks", pct: 95 });
    // keep the progress visible long enough to read, never longer
    const left = 450 - (performance.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    const updates = fixtures.map((f) => f.oddsUpdated).filter(Boolean) as string[];
    const r: RunResult = {
      matches,
      leagues: groupByLeague(matches),
      tf,
      at: Date.now(),
      demo: provider.isDemo,
      oddsUpdated: updates.sort().at(-1),
      priced: fixtures.filter((f) => Object.keys(f.odds).length > 0).length,
    };
    lastRun = r;
    setResult(r);
    setProgress(null);
    setView("matches");
    setEditing(false);
  }

  const stale = result && (result.tf !== tf || groups.some((g) => !result.matches[0]?.options.some((o) => o.group === g)));

  return (
    <div className="pb-28">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="h-page">Research</h1>
          <p className="mt-1 text-sm text-muted">Pick a time frame and markets. BonzStakes scans every match for you.</p>
        </div>
        {provider.isDemo ? (
          <Link href="/account#data-source" className="demo-pill" title="Sample matches and odds. Connect live data in Account.">
            <Database size={13} aria-hidden /> Demo data
          </Link>
        ) : (
          <span className="live-pill">
            <Wifi size={13} aria-hidden /> Live
          </span>
        )}
      </div>

      {!editing && result && !progress ? (
        <section className="card flex items-center justify-between gap-3 px-4 py-3" aria-label="Current search">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{TIME_FRAMES.find((t) => t.id === result.tf)?.label}</div>
            <div className="truncate text-[12px] text-muted">
              {MARKET_GROUPS.filter((g) => groups.includes(g.id)).map((g) => g.short).join(" · ")}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
              Change
            </button>
            <button className="btn-primary btn-sm" onClick={run} aria-label="Research again">
              <RefreshCw size={14} aria-hidden />
            </button>
          </div>
        </section>
      ) : (
      <section className="card-pad space-y-4" aria-label="Research filters">
        <div>
          <h2 className="label">When</h2>
          <div className="scroll-row" role="group" aria-label="Time frame">
            {TIME_FRAMES.map((t) => (
              <button key={t.id} className="chip shrink-0" aria-pressed={tf === t.id} onClick={() => setTf(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="label">Markets</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Markets to research">
            {MARKET_GROUPS.map((g) => (
              <button key={g.id} className="chip" aria-pressed={groups.includes(g.id)} onClick={() => toggle(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full !min-h-12 text-[15px]" onClick={run} disabled={!!progress || !hydrated}>
          <Search size={17} aria-hidden />
          {progress ? "Researching…" : result && !stale ? "Research again" : "Research matches"}
        </button>
        {learned > 0 && (
          <p className="hint text-center">Tuned by {learned} settled {learned === 1 ? "pick" : "picks"} from your past slips.</p>
        )}
      </section>
      )}

      {progress && (
        <div className="card-pad mt-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[13px]">
            <span>{progress.label}</span>
            <span className="num text-muted">{Math.round(progress.pct)}%</span>
          </div>
          <div className="progress mt-2">
            <span style={{ transform: `scaleX(${progress.pct / 100})` }} />
          </div>
        </div>
      )}

      {error && !progress && (
        <div className="card-pad mt-4 flex items-start gap-3" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{error}</p>
            <div className="mt-2 flex gap-2">
              <button className="btn-secondary btn-sm" onClick={run}>Try again</button>
              <Link href="/account#data-source" className="btn-ghost btn-sm">Data settings</Link>
            </div>
          </div>
        </div>
      )}

      {result && !progress && (
        <div className="mt-6">
          <p className="num mb-3 text-[13px] text-muted" aria-live="polite">
            {result.matches.length} matches · {result.leagues.length} leagues
            {result.oddsUpdated && <> · odds {ago(result.oddsUpdated)}</>}
            {!result.demo && result.priced < result.matches.length && <> · {result.matches.length - result.priced} without prices</>}
            {stale && <span className="text-warn"> · filters changed, tap Research again</span>}
          </p>

          {result.matches.length === 0 ? (
            <div className="card-pad text-center text-sm text-muted">No matches in this time frame. Try a longer one.</div>
          ) : (
            <>
              <Tabs<View>
                label="Results"
                value={view}
                onChange={setView}
                tabs={[
                  { value: "matches", label: "Matches", count: result.matches.length },
                  { value: "picks", label: "Top picks" },
                  { value: "builder", label: "Build a slip" },
                ]}
              />
              {view === "matches" && <MatchesView leagues={result.leagues} slip={slip} />}
              {view === "picks" && <Suggestions matches={result.matches} slip={slip} />}
              {view === "builder" && <SlipBuilder matches={result.matches} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
