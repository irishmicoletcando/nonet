// Safe localStorage wrapper for Nonet progress.
// Every access is guarded: if storage is unavailable, full, or holds bad data,
// the app keeps working from an in-memory store for the rest of the session.

import { useSyncExternalStore } from "react";
import { TECHNIQUE_ORDER, type Difficulty, type Technique } from "./engine";

export const STORAGE_KEY = "nonet:v1";

export interface SavedGame {
  seed: number;
  difficulty: Difficulty;
  daily: boolean;
  puzzle: number[];
  solution: number[];
  values: number[];
  notes: number[];
  mistakes: number;
  seconds: number;
  status: "playing" | "won" | "lost";
  hintsUsed: number;
  dateKey: string;
}

export interface Solve {
  date: string;
  difficulty: Difficulty;
  seconds: number;
  mistakes: number;
  daily: boolean;
}

export interface NonetStore {
  version: 1;
  playedDays: string[];
  solves: Solve[];
  games: { daily?: SavedGame; quick?: SavedGame };
  drills: Partial<Record<Technique, { correct: number; attempted: number }>>;
  drillsByDay: Record<string, number>;
  reviewedDaily: string[];
}

export function defaultStore(): NonetStore {
  return { version: 1, playedDays: [], solves: [], games: {}, drills: {}, drillsByDay: {}, reviewedDaily: [] };
}

/** Frozen default used for the server render and the hydration pass. */
const SERVER_SNAPSHOT: NonetStore = defaultStore();

// ---------- validation ----------
const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard", "Expert", "Fiendish"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isDate = (x: unknown): x is string => typeof x === "string" && DATE_RE.test(x);
const isGrid = (x: unknown): x is number[] => Array.isArray(x) && x.length === 81 && x.every(isNum);

function isSavedGame(x: unknown): x is SavedGame {
  if (!isObj(x)) return false;
  return (
    isNum(x.seed) &&
    DIFFS.includes(x.difficulty as Difficulty) &&
    typeof x.daily === "boolean" &&
    isGrid(x.puzzle) && isGrid(x.solution) && isGrid(x.values) && isGrid(x.notes) &&
    isNum(x.mistakes) && isNum(x.seconds) && isNum(x.hintsUsed) &&
    (x.status === "playing" || x.status === "won" || x.status === "lost") &&
    isDate(x.dateKey)
  );
}

function isSolve(x: unknown): x is Solve {
  return (
    isObj(x) && isDate(x.date) && DIFFS.includes(x.difficulty as Difficulty) &&
    isNum(x.seconds) && isNum(x.mistakes) && typeof x.daily === "boolean"
  );
}

/** Returns a valid store, or null if the value does not have the v1 shape. */
export function parseStore(raw: unknown): NonetStore | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const { playedDays, solves, games, drills, drillsByDay, reviewedDaily } = raw;
  if (!Array.isArray(playedDays) || !playedDays.every(isDate)) return null;
  if (!Array.isArray(solves) || !solves.every(isSolve)) return null;
  if (!isObj(games)) return null;
  if (games.daily !== undefined && !isSavedGame(games.daily)) return null;
  if (games.quick !== undefined && !isSavedGame(games.quick)) return null;
  if (!isObj(drills)) return null;
  for (const [k, v] of Object.entries(drills)) {
    if (!TECHNIQUE_ORDER.includes(k as Technique)) return null;
    if (!isObj(v) || !isNum(v.correct) || !isNum(v.attempted)) return null;
  }
  if (!isObj(drillsByDay) || !Object.entries(drillsByDay).every(([k, v]) => isDate(k) && isNum(v))) return null;
  if (!Array.isArray(reviewedDaily) || !reviewedDaily.every(isDate)) return null;
  return raw as unknown as NonetStore;
}

/** Dedupe and cap the lists so storage never grows without bound. */
function trim(s: NonetStore): NonetStore {
  const days = [...new Set(s.playedDays)].sort().slice(-400);
  const byDay = Object.fromEntries(
    Object.entries(s.drillsByDay).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-14),
  );
  return {
    ...s,
    playedDays: days,
    solves: s.solves.slice(-500),
    drillsByDay: byDay,
    reviewedDaily: [...new Set(s.reviewedDaily)].sort().slice(-14),
  };
}

// ---------- access ----------
let cache: NonetStore | null = null;
let memoryOnly = false;
const listeners = new Set<() => void>();

function readStorage(): NonetStore {
  if (memoryOnly) return defaultStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultStore();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    return parseStore(parsed) ?? defaultStore();
  } catch {
    // SecurityError (blocked storage) or similar: stay in memory from now on.
    memoryOnly = true;
    return defaultStore();
  }
}

/** Current store. Client-only; on the server it returns defaults. */
export function load(): NonetStore {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (cache === null) cache = readStorage();
  return cache;
}

/** Apply `fn` to the store, persist it if possible, and notify subscribers. Never throws. */
export function update(fn: (s: NonetStore) => NonetStore): void {
  if (typeof window === "undefined") return;
  let next: NonetStore;
  try {
    next = trim(fn(load()));
  } catch {
    return;
  }
  cache = next;
  if (!memoryOnly) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // QuotaExceeded or blocked: keep going in memory.
      memoryOnly = true;
    }
  }
  listeners.forEach((l) => l());
}

function onStorageEvent(e: StorageEvent) {
  // In memory-only mode the cache is the only copy, so dropping it would wipe the session.
  if (memoryOnly) return;
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  cache = null;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorageEvent);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorageEvent);
  };
}

const getServerSnapshot = () => SERVER_SNAPSHOT;

/** React hook: the store, with defaults during server render and hydration. */
export function useNonetStore(): NonetStore {
  return useSyncExternalStore(subscribe, load, getServerSnapshot);
}
