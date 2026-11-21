"use client";

import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { Badge, EmptyState, Field } from "@/components/ui";
import { toast } from "@/components/Toaster";
import { addNote, deleteNote, useAppState } from "@/lib/store";
import { dateShort } from "@/lib/format";

const TAGS = ["Lesson", "Idea", "Mistake", "Strategy"];

export default function JournalPage() {
  const state = useAppState();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");

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
      <p className="mt-1 mb-5 text-sm text-muted">What you noticed, what worked, what to avoid. Your own patterns are the best data you have.</p>

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
    </div>
  );
}
