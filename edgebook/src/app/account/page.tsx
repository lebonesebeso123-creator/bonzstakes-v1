"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Field, Stat } from "@/components/ui";
import { DataSourceCard, SyncCard } from "@/components/AccountExtras";
import { toast } from "@/components/Toaster";
import {
  addAdjustment,
  eraseAll,
  exportData,
  importData,
  resetBankroll,
  updateSettings,
  useAppState,
} from "@/lib/store";
import { bankrollOf } from "@/lib/stats";
import { dateShort, money } from "@/lib/format";

const CURRENCIES = ["BWP", "ZAR", "USD", "EUR", "GBP", "KES", "NGN", "GHS"];

export default function AccountPage() {
  const state = useAppState();
  const { settings } = state;
  const cur = settings.currency;
  const br = bankrollOf(state);
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [resetAmt, setResetAmt] = useState("1000");
  const [clearBets, setClearBets] = useState(true);
  const [erase, setErase] = useState("");
  const [importErr, setImportErr] = useState("");

  const amt = Number(amount.replace(",", "."));
  const adjust = (sign: 1 | -1) => {
    if (!isFinite(amt) || amt <= 0) return;
    if (sign === -1 && amt > br.balance) {
      toast("That's more than your available balance");
      return;
    }
    addAdjustment({ amount: sign * amt, note: note.trim() || (sign === 1 ? "Top-up" : "Withdrawal") });
    setAmount("");
    setNote("");
    toast(sign === 1 ? "Paper funds added" : "Paper funds removed");
  };

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bonzstakes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!window.confirm("Importing replaces your current data on this device. Continue?")) return;
    const res = importData(await f.text());
    setImportErr(res.ok ? "" : res.error ?? "Import failed.");
    if (res.ok) toast("Backup restored");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-3xl">
      <h1 className="h-page">Account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Your paper bankroll, staking rules and data. Everything stays on this device.</p>

      <section className="mb-8" aria-labelledby="bk">
        <h2 id="bk" className="h-section mb-3">Paper bankroll</h2>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Available" value={money(br.balance, cur)} />
          <Stat label="In play" value={money(br.openStake, cur)} />
          <Stat label="Started with" value={money(state.startingBankroll, cur)} />
        </div>
        <div className="card-pad space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount (${cur})`}>
              {(id) => <input id={id} className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
            <Field label="Note (optional)">
              {(id) => <input id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => adjust(1)}>Add funds</button>
            <button className="btn-secondary" onClick={() => adjust(-1)}>Remove funds</button>
          </div>
          {state.adjustments.length > 0 && (
            <ul className="num border-t pt-3 text-sm" style={{ borderColor: "var(--border)" }}>
              {[...state.adjustments].reverse().slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between py-1">
                  <span className="font-sans text-muted">{dateShort(a.date)} · {a.note}</span>
                  <span className={a.amount >= 0 ? "text-emerald-400" : "text-danger"}>{money(a.amount, cur, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8" aria-labelledby="stk">
        <h2 id="stk" className="h-section mb-3">Preferences</h2>
        <div className="card-pad grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            {(id) => (
              <select id={id} className="input" value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          </Field>
        </div>
      </section>

      <DataSourceCard />
      <SyncCard />

      <section className="mb-8" aria-labelledby="dat">
        <h2 id="dat" className="h-section mb-3">Your data</h2>
        <div className="card-pad space-y-4">
          <p className="text-sm text-muted">
            Saved in this browser only. Clearing site data erases it, so download a backup now and then,
            and use it to move to another device.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={download}><Download size={16} aria-hidden /> Download backup</button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden /> Restore backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose backup file" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {importErr && <p className="text-sm text-danger" role="alert">{importErr}</p>}
        </div>
      </section>

      <section className="mb-8" aria-labelledby="dng">
        <h2 id="dng" className="h-section mb-3">Reset</h2>
        <div className="card-pad space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Restart the bankroll</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={`New starting amount (${cur})`}>
                {(id) => <input id={id} className="input num w-40" inputMode="decimal" value={resetAmt} onChange={(e) => setResetAmt(e.target.value)} />}
              </Field>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[#22c55e]" checked={clearBets} onChange={(e) => setClearBets(e.target.checked)} />
                Also delete all bets
              </label>
              <button
                className="btn-secondary"
                onClick={() => {
                  const n = Number(resetAmt.replace(",", "."));
                  if (!isFinite(n) || n < 0) return;
                  if (window.confirm("Restart your paper bankroll?")) {
                    resetBankroll(n, clearBets);
                    toast("Bankroll restarted");
                  }
                }}
              >
                Restart
              </button>
            </div>
          </div>
          <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="mb-1 text-sm font-semibold">Erase everything</h3>
            <p className="hint mb-2">Deletes bets, notes, learning and settings from this device. Type ERASE to confirm.</p>
            <div className="flex flex-wrap gap-2">
              <input className="input w-40" aria-label="Type ERASE to confirm" value={erase} onChange={(e) => setErase(e.target.value)} placeholder="ERASE" />
              <button className="btn-danger" disabled={erase !== "ERASE"} onClick={() => { eraseAll(); setErase(""); toast("All data erased"); }}>
                Erase all data
              </button>
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted">
        <Link href="/about" className="underline underline-offset-2 hover:text-foreground">How the models work, limits and responsible use</Link>
      </p>
    </div>
  );
}
