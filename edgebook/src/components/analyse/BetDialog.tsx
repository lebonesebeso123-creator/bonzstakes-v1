"use client";

import { useState } from "react";
import { Field, Modal } from "@/components/ui";
import { money } from "@/lib/format";
import { parseOdds } from "@/lib/odds";
import { BetDraft } from "./MarketsPanel";

export default function BetDialog({
  draft,
  currency,
  balance,
  matchLabel,
  onClose,
  onConfirm,
}: {
  draft: BetDraft | null;
  currency: string;
  balance: number;
  matchLabel: string;
  onClose: () => void;
  onConfirm: (d: { odds: number; stake: number; note: string }) => void;
}) {
  return (
    <Modal open={!!draft} onClose={onClose} title="Place paper bet">
      {draft && (
        <Inner
          key={draft.key + draft.odds}
          draft={draft}
          currency={currency}
          balance={balance}
          matchLabel={matchLabel}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function Inner({
  draft,
  currency,
  balance,
  matchLabel,
  onClose,
  onConfirm,
}: {
  draft: BetDraft;
  currency: string;
  balance: number;
  matchLabel: string;
  onClose: () => void;
  onConfirm: (d: { odds: number; stake: number; note: string }) => void;
}) {
  const fallback = Math.max(0, Math.floor(balance * 0.01 * 100) / 100);
  const [stake, setStake] = useState(String(draft.suggested > 0 ? draft.suggested : fallback));
  const [oddsText, setOddsText] = useState(String(draft.odds));
  const [note, setNote] = useState("");

  const odds = parseOdds(oddsText);
  const s = Number(stake.replace(",", "."));
  let error = "";
  if (!odds) error = "Enter valid odds.";
  else if (!isFinite(s) || s <= 0) error = "Enter a stake above zero.";
  else if (s > balance) error = `Stake is above your available balance (${money(balance, currency)}).`;

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <span className="text-foreground">{draft.selection}</span> · {draft.groupTitle}
        <br />
        {matchLabel}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Odds">
          {(id) => <input id={id} className="input num" inputMode="decimal" value={oddsText} onChange={(e) => setOddsText(e.target.value)} />}
        </Field>
        <Field label={`Stake (${currency})`}>
          {(id) => <input id={id} className="input num" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />}
        </Field>
      </div>
      {draft.suggested === 0 && (
        <p className="hint">No stake is suggested at the cautious end of the range, so this is pre-filled at 1% for tracking only.</p>
      )}
      <Field label="Note (optional)" className="mt-3">
        {(id) => <input id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="num mt-4 flex justify-between rounded-lg px-3 py-2.5 text-sm" style={{ background: "var(--surface)" }}>
        <span className="text-muted">Potential return</span>
        <span>{odds && isFinite(s) && s > 0 ? money(s * odds, currency) : "–"}</span>
      </div>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="hint mt-3">Paper stake: no real money moves. Placing it just records it for tracking.</p>
      <div className="mt-5 flex gap-2">
        <button className="btn-primary flex-1" disabled={!!error} onClick={() => odds && onConfirm({ odds, stake: s, note })}>
          Place paper bet
        </button>
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
