import { useSyncExternalStore } from "react";
import {
  Adjustment,
  AppState,
  Bet,
  BetStatus,
  Note,
  SavedAnalysis,
  Settings,
  AnalysisResult,
} from "./types";
import { uid } from "./format";

const KEY = "bonzstakes:v2";

export const DEFAULT_SETTINGS: Settings = {
  currency: "BWP",
  kellyFraction: 0.25,
  maxStakePct: 3,
  evThreshold: 0.05,
};

function fresh(ack: string | null): AppState {
  return {
    v: 2,
    ackAt: ack,
    startingBankroll: 1000,
    adjustments: [],
    bets: [],
    analyses: [],
    notes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Used for server rendering and the first client render, so nothing mismatches. */
const SERVER_STATE: AppState = fresh("server");

let cache: AppState | null = null;
const listeners = new Set<() => void>();

function normalise(raw: Partial<AppState>): AppState {
  const base = fresh(raw.ackAt ?? null);
  return {
    ...base,
    ...raw,
    v: 2,
    adjustments: Array.isArray(raw.adjustments) ? raw.adjustments : [],
    bets: Array.isArray(raw.bets) ? raw.bets : [],
    analyses: Array.isArray(raw.analyses) ? raw.analyses : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    startingBankroll:
      typeof raw.startingBankroll === "number" && raw.startingBankroll >= 0
        ? raw.startingBankroll
        : 1000,
  };
}

/** Pull journal notes and bankroll from the first (prototype) version of the app. */
function migrateLegacy(): AppState | null {
  try {
    const notesRaw = localStorage.getItem("edgebook_journal");
    const accRaw = localStorage.getItem("edgebook_account");
    if (!notesRaw && !accRaw) return null;
    const s = fresh(null);
    if (accRaw) {
      const acc = JSON.parse(accRaw);
      if (typeof acc.totalDeposited === "number") s.startingBankroll = acc.totalDeposited;
      if (typeof acc.currency === "string") s.settings.currency = acc.currency;
    }
    if (notesRaw) {
      const legacy = JSON.parse(notesRaw) as {
        id: string;
        title: string;
        body: string;
        createdAt: string;
        tags?: string[];
      }[];
      s.notes = legacy.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        tag: n.tags?.[0],
      }));
    }
    return s;
  } catch {
    return null;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw));
  } catch {
    /* fall through */
  }
  return migrateLegacy() ?? fresh(null);
}

function getSnapshot(): AppState {
  if (!cache) cache = load();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function update(fn: (s: AppState) => AppState) {
  cache = fn(getSnapshot());
  persist();
  emit();
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/* ---------- actions ---------- */

export const acknowledge = () => update((s) => ({ ...s, ackAt: new Date().toISOString() }));

export function addBet(b: Omit<Bet, "id" | "placedAt" | "status">): Bet {
  const bet: Bet = { ...b, id: uid(), placedAt: new Date().toISOString(), status: "open" };
  update((s) => ({ ...s, bets: [bet, ...s.bets] }));
  return bet;
}

export function settleBet(id: string, status: BetStatus) {
  update((s) => ({
    ...s,
    bets: s.bets.map((b) =>
      b.id === id
        ? { ...b, status, settledAt: status === "open" ? undefined : new Date().toISOString() }
        : b
    ),
  }));
}

export function patchBet(id: string, patch: Partial<Bet>) {
  update((s) => ({ ...s, bets: s.bets.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
}

export const deleteBet = (id: string) =>
  update((s) => ({ ...s, bets: s.bets.filter((b) => b.id !== id) }));

export function saveAnalysis(a: SavedAnalysis) {
  update((s) => {
    const exists = s.analyses.some((x) => x.id === a.id);
    return {
      ...s,
      analyses: exists
        ? s.analyses.map((x) => (x.id === a.id ? a : x))
        : [a, ...s.analyses],
    };
  });
}

export const deleteAnalysis = (id: string) =>
  update((s) => ({ ...s, analyses: s.analyses.filter((a) => a.id !== id) }));

export function setAnalysisResult(id: string, result: AnalysisResult | undefined) {
  update((s) => ({
    ...s,
    analyses: s.analyses.map((a) => (a.id === id ? { ...a, result } : a)),
  }));
}

export function addNote(n: Omit<Note, "id" | "createdAt">) {
  update((s) => ({
    ...s,
    notes: [{ ...n, id: uid(), createdAt: new Date().toISOString() }, ...s.notes],
  }));
}

export const deleteNote = (id: string) =>
  update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));

export function addAdjustment(a: Omit<Adjustment, "id" | "date">) {
  update((s) => ({
    ...s,
    adjustments: [...s.adjustments, { ...a, id: uid(), date: new Date().toISOString() }],
  }));
}

export function resetBankroll(amount: number, clearBets: boolean) {
  update((s) => ({
    ...s,
    startingBankroll: amount,
    adjustments: [],
    bets: clearBets ? [] : s.bets,
  }));
}

export function updateSettings(p: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...p } }));
}

export function exportData(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

export function importData(json: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || parsed.v !== 2) {
      return { ok: false, error: "This doesn't look like a BonzStakes backup file." };
    }
    cache = normalise({ ...parsed, ackAt: getSnapshot().ackAt ?? parsed.ackAt });
    persist();
    emit();
    return { ok: true };
  } catch {
    return { ok: false, error: "That file couldn't be read. Is it valid JSON?" };
  }
}

export function eraseAll() {
  cache = fresh(getSnapshot().ackAt);
  persist();
  emit();
}
