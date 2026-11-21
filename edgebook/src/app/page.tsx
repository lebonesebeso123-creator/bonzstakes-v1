"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Database, Layers, ListChecks, Search, Sparkles } from "lucide-react";
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
  key: string;
  matches: AnalysedMatch[];
  leagues: LeagueGroup[];
  tf: TimeFrame;
  at: number;
  demo: boolean;
  oddsUpdated?: string;
  priced: number;
}

/* Kept outside React so results and filters survive moving between pages. */
const runCache = new Map<string, RunResult>();
let lastFilters: { tf: TimeFrame; groups: MarketGroup[]; view: View } = {
  tf: "today",
  groups: ["1x2", "btts", "goals", "corners"],
  view: "matches",
};
const CACHE_MS = 5 * 60_000;
const remember = (p: Partial<typeof lastFilters>) => {
  lastFilters = { ...lastFilters, ...p };
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
}

function headline(tf: TimeFrame) {
  const d = new Date();
  if (tf === "today") return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (tf === "tomorrow") {
    d.setDate(d.getDate() + 1);
    return `Tomorrow, ${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`;
  }
  return TIME_FRAMES.find((t) => t.id === tf)!.label;
}

const initials = (name: string) => {
  const w = name.split(/\s+/).filter((x) => /[A-Za-zÀ-ÿ]/.test(x[0]));
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join("") : name.slice(0, 2)).toUpperCase();
};

/* ---------------- matches ---------------- */

type Sort = "kickoff" | "likely" | "value";
const topProb = (m: AnalysedMatch) => Math.max(0, ...m.best.map((p) => p.prob));
const topEdge = (m: AnalysedMatch) => Math.max(-1, ...m.options.filter((o) => o.prob >= 0.35).map((p) => p.edge ?? -1));

function League({ g, slip, defaultOpen, delay }: { g: LeagueGroup; slip: Map<string, string>; defaultOpen: boolean; delay: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label={`${g.name}, ${g.country}`} className="rise" style={{ animationDelay: `${delay}ms` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="league-head">
        <span className="flex min-w-0 items-center gap-3 text-left">
          <span className="league-badge" aria-hidden>
            {initials(g.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold">{g.name}</span>
            <span className="block text-[12px] text-muted">{g.country}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="num">{g.matches.length}</span>
          <ChevronDown size={17} aria-hidden className="chev" data-open={open} />
        </span>
      </button>
      <div className="expand" data-open={open}>
        <div>
          <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
            {g.matches.map((m) => (
              <MatchCard key={m.fixture.id} m={m} slipKey={slip.get(m.fixture.id)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

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
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="input !pl-10"
            placeholder="Search a team or league"
            aria-label="Search a team or league"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="scroll-row" role="group" aria-label="Sort and filter matches">
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
          <span className="mx-1 w-px shrink-0 self-stretch bg-tint/10" aria-hidden />
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
        <div className="space-y-4">
          {shown.map((g, idx) => (
            <League
              key={g.key + (filtering ? ":f" : "")}
              g={g}
              slip={slip}
              defaultOpen={filtering || idx < 3}
              delay={Math.min(idx, 6) * 45}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="skeleton h-14" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="skeleton h-64" />
        <div className="skeleton hidden h-64 sm:block" />
      </div>
      <div className="skeleton h-14" />
    </div>
  );
}

/* ---------------- page ---------------- */

const VIEWS: { id: View; label: string; Icon: typeof Layers }[] = [
  { id: "matches", label: "Matches", Icon: Layers },
  { id: "picks", label: "Top picks", Icon: ListChecks },
  { id: "builder", label: "Build a slip", Icon: Sparkles },
];

export default function ResearchPage() {
  const hydrated = useHydrated();
  const state = useAppState();
  const [tf, setTf] = useState<TimeFrame>(lastFilters.tf);
  const [groups, setGroups] = useState<MarketGroup[]>(lastFilters.groups);
  const [view, setView] = useState<View>(lastFilters.view);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const userPickedTf = useRef(lastFilters.tf !== "today");

  const slip = useMemo(() => new Map((state.slip ?? []).map((l) => [l.fixtureId, l.key])), [state.slip]);
  const learning = useMemo(() => learningFrom(state.bets, state.learningSince), [state.bets, state.learningSince]);
  const learned = useMemo(() => Object.values(learning).reduce((a, s) => a + s.n, 0), [learning]);
  const dataUrl = state.settings.dataUrl;
  const provider = getProvider(dataUrl);
  const learningRef = useRef(learning);
  useEffect(() => {
    learningRef.current = learning;
  }, [learning]);

  const run = useCallback(
    async (frame: TimeFrame, markets: MarketGroup[], force = false) => {
      const key = `${frame}|${[...markets].sort().join(",")}|${dataUrl ?? "demo"}|${learned}`;
      const hit = runCache.get(key);
      if (hit && !force && Date.now() - hit.at < CACHE_MS) {
        setResult(hit);
        setLoading(false);
        setError(null);
        return hit;
      }
      setLoading(true);
      setError(null);
      if (!provider.isDemo && typeof navigator !== "undefined" && !navigator.onLine) {
        setLoading(false);
        setError("You're offline. Connect to the internet to load live matches.");
        return null;
      }
      const started = performance.now();
      try {
        const { from, to } = rangeFor(frame);
        const fixtures = await provider.getFixtures(from, to);
        const avg = leagueGoalAverages(fixtures);
        const matches: AnalysedMatch[] = [];
        for (const f of fixtures) {
          if (f.status === "POSTPONED" || f.status === "CANCELLED") continue;
          const m = analyseFixture(f, markets, learningRef.current, avg[f.league.id]);
          if (m) matches.push(m);
        }
        const updates = fixtures.map((f) => f.oddsUpdated).filter(Boolean) as string[];
        const r: RunResult = {
          key,
          matches,
          leagues: groupByLeague(matches),
          tf: frame,
          at: Date.now(),
          demo: provider.isDemo,
          oddsUpdated: updates.sort().at(-1),
          priced: fixtures.filter((f) => Object.keys(f.odds).length > 0).length,
        };
        // a short, steady skeleton reads better than a flash
        const left = 280 - (performance.now() - started);
        if (left > 0) await new Promise((res) => setTimeout(res, left));
        runCache.set(key, r);
        setResult(r);
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load matches.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [provider, dataUrl, learned]
  );

  // Load automatically, and again whenever the filters change.
  useEffect(() => {
    if (!hydrated) return;
    remember({ tf, groups });
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await run(tf, groups);
      if (cancelled || !r) return;
      if (tf === "today" && r.matches.length === 0 && !userPickedTf.current) {
        setNote("No more matches today, so here's tomorrow.");
        setTf("tomorrow");
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hydrated, tf, groups, run]);

  const chooseTf = (t: TimeFrame) => {
    userPickedTf.current = true;
    setNote(null);
    setTf(t);
  };
  const toggle = (g: MarketGroup) =>
    setGroups((cur) => (cur.includes(g) ? (cur.length > 1 ? cur.filter((x) => x !== g) : cur) : [...cur, g]));
  const chooseView = (v: View) => {
    remember({ view: v });
    setView(v);
  };
  const viewIdx = VIEWS.findIndex((v) => v.id === view);

  return (
    <div className="pb-32">
      <header className="rise mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="h-page">{headline(tf)}</h1>
          {provider.isDemo ? (
            <Link href="/account#data-source" className="demo-pill mt-1.5" title="Sample matches and odds. Connect live data in Account.">
              <Database size={12} aria-hidden /> Demo
            </Link>
          ) : (
            <span className="live-pill mt-1.5">
              <span className="live-dot" aria-hidden /> Live
            </span>
          )}
        </div>
        <p className="num mt-2 min-h-5 text-[14px] text-muted" aria-live="polite">
          {loading && !result
            ? "Scanning every league…"
            : result
            ? `${result.matches.length} matches across ${result.leagues.length} leagues` +
              (result.oddsUpdated ? `, odds ${ago(result.oddsUpdated)}` : "") +
              (learned >= 10 ? `, tuned by ${learned} settled picks` : "")
            : ""}
        </p>
        {note && <p className="mt-1 text-[13px] text-sky">{note}</p>}
      </header>

      <section aria-label="Filters" className="space-y-2.5">
        <div className="scroll-row" role="group" aria-label="When">
          {TIME_FRAMES.map((t) => (
            <button key={t.id} className="chip shrink-0" aria-pressed={tf === t.id} onClick={() => chooseTf(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="scroll-row" role="group" aria-label="Markets">
          {MARKET_GROUPS.map((g) => (
            <button key={g.id} className="chip shrink-0" aria-pressed={groups.includes(g.id)} onClick={() => toggle(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* Always one tap away: pinned under the header while you scroll. */}
      <div className="seg-dock mt-3">
        <div role="tablist" aria-label="Research views" className="seg glass-bar grid-cols-3">
          <span
            className="seg-thumb"
            style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${viewIdx * 100}%)` }}
            aria-hidden
          />
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} role="tab" aria-selected={view === id} className="seg-btn" onClick={() => chooseView(id)}>
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {error ? (
          <div className="card-pad flex items-start gap-3" role="alert">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{error}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary btn-sm" onClick={() => run(tf, groups, true)}>
                  Try again
                </button>
                <Link href="/account#data-source" className="btn-ghost btn-sm">
                  Data settings
                </Link>
              </div>
            </div>
          </div>
        ) : loading && !result ? (
          <Skeleton />
        ) : result && result.matches.length === 0 ? (
          <div className="card-pad text-center">
            <p className="font-display text-lg font-bold">No matches in this window</p>
            <p className="mt-1 text-sm text-muted">Try a longer time frame.</p>
            <button className="btn-secondary btn-sm mt-4" onClick={() => chooseTf("week")}>
              Show the next 7 days
            </button>
          </div>
        ) : result ? (
          <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
            {view === "matches" && <MatchesView key={result.key} leagues={result.leagues} slip={slip} />}
            {view === "picks" && <Suggestions matches={result.matches} slip={slip} />}
            {view === "builder" && <SlipBuilder matches={result.matches} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
