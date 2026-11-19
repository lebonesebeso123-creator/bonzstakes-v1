"use client";

import { ExternalLink } from "lucide-react";
import { Sport } from "@/lib/types";

const CHECKS = [
  { id: "lineups", label: "Line-ups & injuries checked" },
  { id: "rest", label: "Rest, travel & schedule" },
  { id: "motivation", label: "Motivation & stakes" },
  { id: "conditions", label: "Weather / conditions" },
  { id: "shop", label: "Odds compared across bookmakers" },
  { id: "price", label: "Price still available" },
];

function links(sport: Sport, a: string, b: string) {
  const q = (s: string) => `https://www.google.com/search?q=${encodeURIComponent(s)}`;
  if (sport === "tennis")
    return [
      { label: `${a} recent results`, href: q(`${a} tennis recent results`) },
      { label: `${b} recent results`, href: q(`${b} tennis recent results`) },
      { label: "Head to head", href: q(`${a} vs ${b} head to head`) },
      { label: "Injury / fitness news", href: q(`${a} ${b} injury fitness news`) },
    ];
  return [
    { label: "Team news & injuries", href: q(`${a} vs ${b} team news injuries`) },
    { label: `${a} last 10 results`, href: q(`${a} last 10 results`) },
    { label: `${b} last 10 results`, href: q(`${b} last 10 results`) },
    { label: "Head to head", href: q(`${a} vs ${b} head to head`) },
    ...(sport === "football" ? [{ label: "Predicted line-ups", href: q(`${a} vs ${b} predicted lineups`) }] : []),
  ];
}

export default function ResearchCard({
  sport,
  a,
  b,
  checklist,
  onChecklist,
  notes,
  onNotes,
}: {
  sport: Sport;
  a: string;
  b: string;
  checklist: string[];
  onChecklist: (c: string[]) => void;
  notes: string;
  onNotes: (n: string) => void;
}) {
  const ready = a.trim() && b.trim();
  const toggle = (id: string) =>
    onChecklist(checklist.includes(id) ? checklist.filter((c) => c !== id) : [...checklist, id]);
  return (
    <div className="card-pad space-y-5">
      <div>
        <h3 className="font-mono text-sm font-semibold">Research</h3>
        <p className="hint">
          {ready ? "Opens a web search in a new tab." : "Enter both names above to unlock search links."}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {ready
            ? links(sport, a.trim(), b.trim()).map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip hover:bg-white/10"
                >
                  {l.label}
                  <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ))
            : null}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-sm font-semibold">Pre-bet checklist</h3>
        <div className="flex flex-wrap gap-2">
          {CHECKS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={checklist.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="analysis-notes" className="label">
          Notes
        </label>
        <textarea
          id="analysis-notes"
          className="input"
          rows={3}
          placeholder="Why you like or dislike this one. You'll thank yourself when reviewing later."
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </div>
    </div>
  );
}
