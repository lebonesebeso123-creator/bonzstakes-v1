"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FileSearch, Trash2 } from "lucide-react";
import { Badge, EmptyState, Field, Tabs } from "@/components/ui";
import { toast } from "@/components/Toaster";
import { addNote, deleteAnalysis, deleteNote, setAnalysisResult, useAppState } from "@/lib/store";
import { dateShort, pct } from "@/lib/format";
import { SavedAnalysis, Sport } from "@/lib/types";

type Tab = "analyses" | "notes";
const SPORT_LABEL: Record<Sport, string> = { football: "Football", basketball: "Basketball", tennis: "Tennis" };
const TAGS = ["Lesson", "Idea", "Mistake", "Strategy"];

function ResultForm({ a }: { a: SavedAnalysis }) {
  const [home, setHome] = useState(a.result?.home !== undefined ? String(a.result.home) : "");
  const [away, setAway] = useState(a.result?.away !== undefined ? String(a.result.away) : "");
  const [winner, setWinner] = useState<"a" | "b" | "">(a.result?.winner ?? "");
  const tennis = a.sport === "tennis";
  const names = a.title.split(" vs ");

  const save = () => {
    if (tennis) {
      if (!winner) return;
      setAnalysisResult(a.id, { winner });
    } else {
      const h = Number(home),
        w = Number(away);
      if (home === "" || away === "" || !isFinite(h) || !isFinite(w)) return;
      setAnalysisResult(a.id, { home: h, away: w });
    }
    toast("Result recorded");
  };

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(2,6,23,0.4)" }}>
      <p className="mb-2 text-xs font-medium text-muted">
        {a.result ? "Final result (edit anytime)" : "Record the final result to score the model"}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {tennis ? (
          <select className="input w-auto" aria-label="Winner" value={winner} onChange={(e) => setWinner(e.target.value as "a" | "b" | "")}>
            <option value="">Winner…</option>
            <option value="a">{names[0]}</option>
            <option value="b">{names[1]}</option>
          </select>
        ) : (
          <>
            <input className="input num w-20 text-center" inputMode="numeric" aria-label={`${names[0]} score`} placeholder={names[0]?.slice(0, 6)} value={home} onChange={(e) => setHome(e.target.value.replace(/\D/g, ""))} />
            <span className="pb-3 text-muted" aria-hidden>–</span>
            <input className="input num w-20 text-center" inputMode="numeric" aria-label={`${names[1]} score`} placeholder={names[1]?.slice(0, 6)} value={away} onChange={(e) => setAway(e.target.value.replace(/\D/g, ""))} />
          </>
        )}
        <button className="btn-secondary btn-sm" onClick={save}>Save result</button>
        {a.result && (
          <button className="btn-ghost btn-sm" onClick={() => setAnalysisResult(a.id, undefined)}>Clear</button>
        )}
      </div>
    </div>
  );
}

function AnalysisCard({ a }: { a: SavedAnalysis }) {
  const q = a.summary.quality;
  const r = a.result;
  let outcome = "";
  if (r) {
    if (a.sport === "tennis") outcome = r.winner === "a" ? "home" : "away";
    else if (r.home !== undefined && r.away !== undefined) outcome = r.home > r.away ? "home" : r.home < r.away ? "away" : "draw";
  }
  const pOut = outcome ? (a.summary.probs as Record<string, number | undefined>)[outcome] : undefined;

  return (
    <li className="card-pad">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{SPORT_LABEL[a.sport]}</Badge>
            <Badge tone={q === "good" ? "green" : q === "limited" ? "amber" : "red"}>Data: {q === "poor" ? "thin" : q}</Badge>
            <span className="text-xs text-muted">
              {dateShort(a.updatedAt)}
              {a.league ? ` · ${a.league}` : ""}
            </span>
          </div>
          <h2 className="mt-1.5 truncate font-medium">{a.title}</h2>
          <p className="num mt-0.5 text-[13px] text-muted">{a.summary.headline}</p>
          {a.summary.bestEdge && (
            <p className="mt-1 text-xs text-muted">
              Best edge when saved: <span className="text-emerald-400">{a.summary.bestEdge.label} @ {a.summary.bestEdge.odds.toFixed(2)}</span>
            </p>
          )}
          {r && pOut !== undefined && (
            <p className="mt-1.5 text-xs">
              <Badge tone="violet">Result</Badge>{" "}
              <span className="num">
                {a.sport === "tennis" ? "Winner recorded" : `${r.home}–${r.away}`} · model gave this outcome {pct(pOut)}
              </span>
            </p>
          )}
          {a.notes && <p className="mt-2 line-clamp-3 text-sm text-muted">{a.notes}</p>}
        </div>
      </div>
      <ResultForm key={a.updatedAt + String(!!a.result)} a={a} />
      <div className="mt-3 flex gap-2">
        <Link href={`/?load=${a.id}`} className="btn-primary btn-sm">Open</Link>
        <button
          className="btn-ghost btn-sm ml-auto"
          aria-label={`Delete analysis ${a.title}`}
          onClick={() => window.confirm("Delete this saved analysis?") && deleteAnalysis(a.id)}
        >
          <Trash2 size={15} aria-hidden /> Delete
        </button>
      </div>
    </li>
  );
}

export default function JournalPage() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("analyses");
  const [sport, setSport] = useState<"all" | Sport>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");

  const analyses = state.analyses.filter((a) => sport === "all" || a.sport === sport);
  const notes = state.notes.filter((n) =>
    (n.title + " " + n.body + " " + (n.tag ?? "")).toLowerCase().includes(query.toLowerCase())
  );

  const submit = () => {
    if (!title.trim() && !body.trim()) return;
    addNote({ title: title.trim() || "Untitled", body: body.trim(), tag: tag || undefined });
    setTitle("");
    setBody("");
    setTag("");
    toast("Note added");
  };

  return (
    <div>
      <h1 className="h-page">Journal</h1>
      <p className="mt-1 mb-5 text-sm text-muted">Your saved analyses and reflections. Reviewing them is how the edge actually improves.</p>

      <Tabs<Tab>
        label="Journal"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "analyses", label: "Saved analyses", count: state.analyses.length },
          { value: "notes", label: "Notes", count: state.notes.length },
        ]}
      />

      {tab === "analyses" &&
        (state.analyses.length === 0 ? (
          <EmptyState
            icon={<FileSearch size={28} />}
            title="No saved analyses"
            body="Analyse a match and tap “Save to Journal”. Later, record the final score to see how the model did."
            action={<Link href="/" className="btn-primary">Analyse a match</Link>}
          />
        ) : (
          <>
            <label className="mb-4 block text-xs text-muted">
              <span className="mb-1 block">Sport</span>
              <select className="input w-auto" value={sport} onChange={(e) => setSport(e.target.value as "all" | Sport)}>
                <option value="all">All sports</option>
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="tennis">Tennis</option>
              </select>
            </label>
            <ul className="space-y-3">
              {analyses.map((a) => (
                <AnalysisCard key={a.id} a={a} />
              ))}
            </ul>
          </>
        ))}

      {tab === "notes" && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="card-pad space-y-3">
            <h2 className="h-section">New note</h2>
            <Field label="Title">{(id) => <input id={id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
            <Field label="What happened, what did you learn?">
              {(id) => <textarea id={id} className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />}
            </Field>
            <div>
              <span className="label">Tag (optional)</span>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={submit}>Add note</button>
          </div>

          <div>
            {state.notes.length > 0 && (
              <input className="input mb-3" type="search" placeholder="Search notes…" aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
            )}
            {state.notes.length === 0 ? (
              <EmptyState icon={<BookOpen size={28} />} title="No notes yet" body="Write down why you took (or skipped) a bet. Patterns in your own thinking are the most valuable data you have." />
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted">No notes match “{query}”.</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="card-pad">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-medium">{n.title}</h2>
                        <p className="text-xs text-muted">
                          {dateShort(n.createdAt)} {n.tag && <Badge tone="neutral" className="ml-1">{n.tag}</Badge>}
                        </p>
                      </div>
                      <button
                        className="btn-ghost btn-sm !px-2"
                        aria-label={`Delete note ${n.title}`}
                        onClick={() => window.confirm("Delete this note?") && deleteNote(n.id)}
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                    {n.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
