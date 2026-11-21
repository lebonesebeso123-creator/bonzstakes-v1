"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock, XCircle } from "lucide-react";
import { useAppState } from "@/lib/store";
import { localDay } from "@/lib/research/engine";
import { TrackedPick } from "@/lib/types";
import { EmptyState } from "@/components/ui";

function Icon({ s }: { s: TrackedPick["status"] }) {
  if (s === "won") return <CheckCircle2 size={16} className="text-mint" aria-label="Landed" />;
  if (s === "lost") return <XCircle size={16} className="text-danger" aria-label="Missed" />;
  if (s === "void") return <Circle size={16} className="text-muted" aria-label="Void" />;
  return <Clock size={16} className="text-muted" aria-label="Pending" />;
}

interface Tally {
  n: number;
  won: number;
  expected: number;
  staked: number;
  returned: number;
}

function tally(picks: TrackedPick[]): Tally {
  const done = picks.filter((p) => p.status === "won" || p.status === "lost");
  const priced = done.filter((p) => p.priced);
  return {
    n: done.length,
    won: done.filter((p) => p.status === "won").length,
    expected: done.reduce((a, p) => a + p.prob, 0),
    staked: priced.length,
    returned: priced.reduce((a, p) => a + (p.status === "won" ? p.odds : 0), 0),
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function dayLabel(day: string) {
  const today = localDay(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === today) return "Today";
  if (day === localDay(y)) return "Yesterday";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function Summary({ title, t, note }: { title: string; t: Tally; note: string }) {
  const roi = t.staked ? t.returned / t.staked - 1 : null;
  return (
    <div className="card-pad">
      <h3 className="font-display text-[16px] font-bold">{title}</h3>
      <p className="hint !mt-0.5">{note}</p>
      {t.n === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing settled yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Landed</div>
            <div className="num text-lg font-bold">
              {t.won}/{t.n}
            </div>
          </div>
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Hit rate</div>
            <div className={`num text-lg font-bold ${t.won / t.n >= t.expected / t.n ? "text-mint" : "text-danger"}`}>
              {pct(t.won / t.n)}
            </div>
            <div className="num text-[11px] text-muted">expected {pct(t.expected / t.n)}</div>
          </div>
          <div className="stat-tile">
            <div className="text-[11px] text-muted">Return at 1 unit</div>
            <div className={`num text-lg font-bold ${roi === null ? "" : roi >= 0 ? "text-mint" : "text-danger"}`}>
              {roi === null ? "–" : `${roi >= 0 ? "+" : "−"}${Math.abs(roi * 100).toFixed(0)}%`}
            </div>
            <div className="num text-[11px] text-muted">{t.staked} priced</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Day({ day, picks, defaultOpen }: { day: string; picks: TrackedPick[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const likely = picks.filter((p) => p.kind === "likely");
  const t = tally(likely);
  const pending = picks.filter((p) => p.status === "open").length;
  return (
    <section className="card overflow-hidden">
      <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold">{dayLabel(day)}</span>
          <span className="num block text-[12px] text-muted">
            {t.n ? `${t.won} of ${t.n} most-likely picks landed` : "Waiting for results"}
            {pending ? `, ${pending} pending` : ""}
          </span>
        </span>
        <ChevronDown size={17} aria-hidden className="chev shrink-0 text-muted" data-open={open} />
      </button>
      <div className="expand" data-open={open}>
        <div>
          {(["likely", "value"] as const).map((kind) => {
            const list = picks.filter((p) => p.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind} className="border-t px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
                <h4 className="mb-1 text-[12px] font-semibold text-muted">{kind === "likely" ? "Most likely" : "Value vs the odds"}</h4>
                <ul className="divide-y">
                  {list.map((p) => (
                    <li key={p.id} className={`flex items-center gap-2.5 py-2 ${p.status === "void" ? "opacity-60" : ""}`}>
                      <Icon s={p.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold">{p.selection}</div>
                        <div className="num truncate text-[12px] text-muted">
                          {p.home} v {p.away}
                          {p.result ? `, ${p.result.home}–${p.result.away}` : ""}
                        </div>
                      </div>
                      <div className="num shrink-0 text-right">
                        <div className="text-[13px] font-semibold">
                          {!p.priced && <span className="opacity-60">≈</span>}
                          {p.odds.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-muted">{pct(p.prob)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** How the app's own daily picks did: recorded before kick-off, settled automatically. */
export default function Scorecard() {
  const state = useAppState();
  const tracked = useMemo(() => state.tracked ?? [], [state.tracked]);
  const days = useMemo(() => {
    const map = new Map<string, TrackedPick[]>();
    for (const t of tracked) map.set(t.day, [...(map.get(t.day) ?? []), t]);
    for (const list of map.values()) list.sort((a, b) => b.prob - a.prob);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tracked]);
  const week = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = tracked.filter((t) => t.day >= localDay(cutoff));
    return { likely: tally(recent.filter((t) => t.kind === "likely")), value: tally(recent.filter((t) => t.kind === "value")) };
  }, [tracked]);

  if (!tracked.length)
    return (
      <EmptyState
        icon={<CheckCircle2 size={28} />}
        title="The scorecard starts today"
        body="Each day BonzStakes records its 10 most likely picks and 5 best value picks before kick-off, then marks them as results come in. Open Research to start."
      />
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Every day BonzStakes records its own top picks before kick-off and checks them after the final whistle, whether you
        bet or not. Each result also feeds what the model learns.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Summary title="Most likely, last 7 days" t={week.likely} note="Ten highest-chance picks a day. A good model lands about as often as it expects." />
        <Summary title="Value, last 7 days" t={week.value} note="Five best prices a day. Fewer wins, but the return is what counts." />
      </div>
      <div className="space-y-3">
        {days.map(([day, picks], i) => (
          <Day key={day} day={day} picks={picks} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
