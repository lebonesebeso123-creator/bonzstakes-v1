import { useSyncExternalStore } from "react";
import {
  Adjustment,
  AppState,
  Bet,
  BetStatus,
  Note,
  Settings,
  Leg,
  TrackedPick,
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
    slip: [],
    deleted: [],
    tracked: [],
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
    slip: Array.isArray(raw.slip) ? raw.slip : [],
    deleted: Array.isArray(raw.deleted) ? raw.deleted : [],
    tracked: Array.isArray(raw.tracked) ? raw.tracked : [],
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
  cache = { ...fn(getSnapshot()), updatedAt: new Date().toISOString() };
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
  update((s) => ({ ...s, bets: s.bets.filter((b) => b.id !== id), deleted: [...(s.deleted ?? []), id] }));

export function addNote(n: Omit<Note, "id" | "createdAt">) {
  update((s) => ({
    ...s,
    notes: [{ ...n, id: uid(), createdAt: new Date().toISOString() }, ...s.notes],
  }));
}

export const deleteNote = (id: string) =>
  update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id), deleted: [...(s.deleted ?? []), id] }));

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
    deleted: [
      ...(s.deleted ?? []),
      ...s.adjustments.map((a) => a.id),
      ...(clearBets ? s.bets.map((b) => b.id) : []),
    ],
  }));
}

export function updateSettings(p: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...p } }));
}

/** Everything worth syncing or backing up: never the sync token or the in-progress slip. */
export function shareable(s: AppState = getSnapshot()): AppState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sync, slip, ...rest } = s;
  return rest as AppState;
}

export function exportData(): string {
  return JSON.stringify(shareable(), null, 2);
}

export const getState = () => getSnapshot();

export function setSync(p: Partial<NonNullable<AppState["sync"]>> | null) {
  const s = getSnapshot();
  cache = { ...s, sync: p === null ? undefined : { ...(s.sync ?? {}), ...p } };
  persist();
  emit();
}

/** Combine two copies of the data (this device + the synced copy) without losing anything. */
export function mergeStates(local: AppState, remote: Partial<AppState>): AppState {
  const r = normalise({ ...remote, ackAt: local.ackAt });
  const deleted = [...new Set([...(local.deleted ?? []), ...(r.deleted ?? [])])];
  const gone = new Set(deleted);
  const union = <T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T) => {
    const map = new Map<string, T>();
    for (const x of a) if (!gone.has(x.id)) map.set(x.id, x);
    for (const y of b) {
      if (gone.has(y.id)) continue;
      const x = map.get(y.id);
      map.set(y.id, x ? pick(x, y) : y);
    }
    return [...map.values()];
  };
  const betRank = (b: Bet) => (b.status === "open" ? 0 : 1);
  const bets = union(local.bets, r.bets, (x, y) =>
    betRank(y) > betRank(x) || (betRank(y) === betRank(x) && (y.settledAt ?? "") > (x.settledAt ?? "")) ? y : x
  ).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const newer = (r.updatedAt ?? "") > (local.updatedAt ?? "") ? r : local;
  return {
    ...local,
    bets,
    notes: union(local.notes, r.notes, (x) => x).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    adjustments: union(local.adjustments, r.adjustments, (x) => x),
    tracked: union(local.tracked ?? [], r.tracked ?? [], (x, y) => (x.status === "open" && y.status !== "open" ? y : x)),
    deleted,
    settings: newer.settings,
    startingBankroll: newer.startingBankroll,
    learningSince: newer.learningSince,
    updatedAt: newer.updatedAt,
  };
}

export function replaceState(next: AppState) {
  cache = next;
  persist();
  emit();
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
  const s = getSnapshot();
  cache = {
    ...fresh(s.ackAt),
    sync: s.sync,
    updatedAt: new Date().toISOString(),
    deleted: [...(s.deleted ?? []), ...s.bets.map((b) => b.id), ...s.notes.map((n) => n.id), ...s.adjustments.map((a) => a.id)],
  };
  persist();
  emit();
}

/* ---------- bet slip (Research page) ---------- */

/** Adds a leg. One per match: a second pick on the same match replaces the first. */
export function addToSlip(leg: Omit<Leg, "id" | "status">): "added" | "replaced" | "removed" {
  let outcome: "added" | "replaced" | "removed" = "added";
  update((s) => {
    const slip = s.slip ?? [];
    const existing = slip.find((l) => l.fixtureId === leg.fixtureId);
    if (existing && existing.key === leg.key) {
      outcome = "removed";
      return { ...s, slip: slip.filter((l) => l.id !== existing.id) };
    }
    const next: Leg = { ...leg, id: uid(), status: "open" };
    if (existing) {
      outcome = "replaced";
      return { ...s, slip: slip.map((l) => (l.id === existing.id ? next : l)) };
    }
    return { ...s, slip: [...slip, next] };
  });
  return outcome;
}

export const removeFromSlip = (id: string) =>
  update((s) => ({ ...s, slip: (s.slip ?? []).filter((l) => l.id !== id) }));

export const clearSlip = () => update((s) => ({ ...s, slip: [] }));

export function replaceSlip(legs: Omit<Leg, "id" | "status">[]) {
  update((s) => ({ ...s, slip: legs.map((l) => ({ ...l, id: uid(), status: "open" as const })) }));
}

export const slipOdds = (legs: Leg[]) =>
  Math.round(legs.reduce((a, l) => a * (l.status === "void" ? 1 : l.odds), 1) * 100) / 100;

/** Turns the slip into a paper bet. Returns the bet id. */
export function placeSlip(stake: number): string | null {
  const s = getSnapshot();
  const legs = s.slip ?? [];
  if (!legs.length || !(stake > 0)) return null;
  const odds = slipOdds(legs);
  const single = legs.length === 1;
  const bet = addBet({
    sport: "football",
    matchLabel: single ? `${legs[0].home} v ${legs[0].away}` : `${legs.length}-fold accumulator`,
    market: single ? legs[0].group : "Accumulator",
    selection: single ? legs[0].selection : legs.map((l) => l.selection).join(" · "),
    odds,
    stake,
    modelProb: legs.reduce((a, l) => a * l.prob, 1),
    legs: legs.map((l) => ({ ...l })),
  });
  clearSlip();
  return bet.id;
}

type LegResult = {
  home: number;
  away: number;
  htHome: number;
  htAway: number;
  corners: number;
  missing?: ("ht" | "corners")[];
};

/** Settles legs from final results (or "void" for postponed/cancelled) and updates each bet. */
export function applyResults(
  results: Record<string, LegResult | "void">,
  settle: (key: string, r: LegResult) => "won" | "lost" | "void"
): number {
  let changed = 0;
  update((s) => {
    const bets = s.bets.map((b) => {
      if (!b.legs || b.status !== "open") return b;
      let touched = false;
      const legs = b.legs.map((l) => {
        const r = results[l.fixtureId];
        if (l.status !== "open" || !r) return l;
        touched = true;
        if (r === "void") return { ...l, status: "void" as const };
        const score = {
          home: r.home,
          away: r.away,
          htHome: r.htHome,
          htAway: r.htAway,
          corners: r.missing?.includes("corners") ? undefined : r.corners,
        };
        return { ...l, status: settle(l.key, r), result: score };
      });
      if (!touched) return b;
      changed++;
      const anyLost = legs.some((l) => l.status === "lost");
      const allDone = legs.every((l) => l.status !== "open");
      const allVoid = legs.every((l) => l.status === "void");
      const status = anyLost ? "lost" : allDone ? (allVoid ? "void" : "won") : "open";
      return {
        ...b,
        legs,
        odds: slipOdds(legs),
        status,
        settledAt: status === "open" ? undefined : new Date().toISOString(),
      } as Bet;
    });
    return { ...s, bets };
  });
  return changed;
}

const TRACK_DAYS = 60;

/** Records picks the first time they're seen; the pre-match estimate is never overwritten. */
export function trackPicks(picks: Omit<TrackedPick, "status" | "recordedAt">[]) {
  const s = getSnapshot();
  const have = new Set((s.tracked ?? []).map((t) => t.id));
  const fresh = picks.filter((p) => !have.has(p.id));
  if (!fresh.length) return;
  const cutoff = new Date(Date.now() - TRACK_DAYS * 86400_000).toISOString();
  const now = new Date().toISOString();
  update((st) => ({
    ...st,
    tracked: [...(st.tracked ?? []).filter((t) => t.kickoff >= cutoff), ...fresh.map((p) => ({ ...p, status: "open" as const, recordedAt: now }))],
  }));
}

/** Settles the app's own picks from final results. */
export function settleTracked(
  results: Record<string, LegResult | "void">,
  settle: (key: string, r: LegResult) => "won" | "lost" | "void"
): number {
  let n = 0;
  update((s) => ({
    ...s,
    tracked: (s.tracked ?? []).map((t) => {
      const r = results[t.fixtureId];
      if (t.status !== "open" || !r) return t;
      n++;
      if (r === "void") return { ...t, status: "void" };
      return {
        ...t,
        status: settle(t.key, r),
        result: { home: r.home, away: r.away, htHome: r.htHome, htAway: r.htAway, corners: r.missing?.includes("corners") ? undefined : r.corners },
      };
    }),
  }));
  return n;
}

/** Replace an estimated price with the one your bookmaker actually offers. */
export function setLegOdds(id: string, odds: number) {
  update((s) => ({
    ...s,
    slip: (s.slip ?? []).map((l) => (l.id === id ? { ...l, odds, priced: true } : l)),
  }));
}

/** Learning only counts slips placed after this moment. */
export const resetLearning = () => update((s) => ({ ...s, learningSince: new Date().toISOString() }));
