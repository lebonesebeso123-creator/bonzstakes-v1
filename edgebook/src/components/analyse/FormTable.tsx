"use client";

import { useState } from "react";
import { ClipboardPaste, Plus, X } from "lucide-react";
import { FormMatch, OppTier, Venue } from "@/lib/types";
import { parseResults, validRows } from "@/lib/models/football";

const MAX_ROWS = 10;

export default function FormTable({
  teamLabel,
  rows,
  onChange,
}: {
  teamLabel: string;
  rows: FormMatch[];
  onChange: (rows: FormMatch[]) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const valid = validRows(rows).length;

  const patch = (i: number, p: Partial<FormMatch>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const add = () =>
    rows.length < MAX_ROWS && onChange([...rows, { gf: "", ga: "", venue: "H", opp: "avg" }]);

  const importPasted = () => {
    const parsed = parseResults(pasted);
    if (parsed.length) {
      onChange(parsed);
      setPasted("");
      setPasteOpen(false);
    }
  };

  return (
    <fieldset>
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{teamLabel}: last results</span>
        <span className="num text-xs text-muted">
          {valid}/{MAX_ROWS} used
        </span>
      </legend>
      <p className="hint mb-2.5">
        Most recent first. Goals <strong className="font-medium text-foreground">for</strong> this
        team, then <strong className="font-medium text-foreground">against</strong>. Venue: H home, A away, N neutral.
      </p>

      {rows.length > 0 && (
        <div className="mb-2 space-y-1.5">
          <div
            className="grid grid-cols-[1.25rem_3rem_0.5rem_3rem_3.5rem_4.25rem_2.25rem] items-center gap-1.5 px-0.5 text-[11px] text-muted sm:grid-cols-[1.5rem_4rem_0.75rem_4rem_4.5rem_5.5rem_2.5rem]"
            aria-hidden
          >
            <span>#</span>
            <span className="text-center">For</span>
            <span />
            <span className="text-center">Agst</span>
            <span title="Home / Away / Neutral">H/A/N</span>
            <span>Opponent</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.25rem_3rem_0.5rem_3rem_3.5rem_4.25rem_2.25rem] items-center gap-1.5 sm:grid-cols-[1.5rem_4rem_0.75rem_4rem_4.5rem_5.5rem_2.5rem]"
            >
              <span className="num text-xs text-muted">{i + 1}</span>
              <input
                className="input num px-1 text-center"
                inputMode="numeric"
                maxLength={2}
                aria-label={`${teamLabel} result ${i + 1}: goals scored`}
                value={r.gf}
                onChange={(e) => patch(i, { gf: e.target.value.replace(/\D/g, "") })}
              />
              <span className="text-center text-muted" aria-hidden>
                –
              </span>
              <input
                className="input num px-1 text-center"
                inputMode="numeric"
                maxLength={2}
                aria-label={`${teamLabel} result ${i + 1}: goals conceded`}
                value={r.ga}
                onChange={(e) => patch(i, { ga: e.target.value.replace(/\D/g, "") })}
              />
              <select
                className="input px-1.5 text-[13px]"
                aria-label={`${teamLabel} result ${i + 1}: venue`}
                value={r.venue}
                onChange={(e) => patch(i, { venue: e.target.value as Venue })}
              >
                <option value="H">H</option>
                <option value="A">A</option>
                <option value="N">N</option>
              </select>
              <select
                className="input px-1.5 text-[13px]"
                aria-label={`${teamLabel} result ${i + 1}: opposition strength`}
                value={r.opp}
                onChange={(e) => patch(i, { opp: e.target.value as OppTier })}
              >
                <option value="strong">Top</option>
                <option value="avg">Mid</option>
                <option value="weak">Low</option>
              </select>
              <button
                type="button"
                className="flex h-11 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-foreground"
                aria-label={`Remove ${teamLabel} result ${i + 1}`}
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={add} disabled={rows.length >= MAX_ROWS}>
          <Plus size={15} aria-hidden /> Add result
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setPasteOpen((v) => !v)}
          aria-expanded={pasteOpen}
        >
          <ClipboardPaste size={15} aria-hidden /> Paste results
        </button>
        {rows.length > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>

      {pasteOpen && (
        <div className="mt-2.5">
          <label className="label" htmlFor={`paste-${teamLabel}`}>
            Paste scores for {teamLabel}
          </label>
          <textarea
            id={`paste-${teamLabel}`}
            className="input num"
            rows={3}
            placeholder={"2-1 H\n0-0 A\n3-2 H"}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <p className="hint">
            One per line or comma separated, this team&apos;s goals first. Add H, A or N for venue
            (defaults to Home). Replaces the current list.
          </p>
          <button type="button" className="btn-primary btn-sm mt-2" onClick={importPasted}>
            Import
          </button>
        </div>
      )}
    </fieldset>
  );
}
