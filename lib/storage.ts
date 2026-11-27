// Safe localStorage wrapper for Nonet progress.
// Every access is guarded: if storage is unavailable, full, or holds bad data,
// the app keeps working from an in-memory store for the rest of the session.

import { useSyncExternalStore } from "react";
import { MISTAKES_ALLOWED } from "./constants";
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
  /** Increments on "Try again", so a restarted game outranks the stale lost copy. Missing = 0. */
  attempt?: number;
  /**
   * Candidates ruled out by hints the user has fully opened (engine Cands format).
   * Hints start from these so an elimination-only hint does not repeat. Missing = none.
   */
  hintElims?: number[];
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

/** Upper bounds for "sane" numbers. */
export const LIMITS = {
  seconds: 10 * 24 * 3600, // ten days on one puzzle
  seed: 2 ** 32 - 1,
  hintsUsed: 100_000,
  attempt: 100_000,
  drillCount: 10_000_000,
} as const;

/** Candidate masks use bits 1..9 only. */
const MASK_ALL = 0x3fe;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isDate = (x: unknown): x is string => typeof x === "string" && DATE_RE.test(x);
const isCells = (x: unknown, min: number, max: number): x is number[] =>
  Array.isArray(x) && x.length === 81 && x.every((v) => isInt(v, min, max));
const isMasks = (x: unknown): x is number[] =>
  Array.isArray(x) && x.length === 81 && x.every((v) => isInt(v, 0, MASK_ALL) && (v & ~MASK_ALL) === 0);

export function isSavedGame(x: unknown): x is SavedGame {
  if (!isObj(x)) return false;
  if (
    !(
      isInt(x.seed, 0, LIMITS.seed) &&
      DIFFS.includes(x.difficulty as Difficulty) &&
      typeof x.daily === "boolean" &&
      isCells(x.puzzle, 0, 9) &&
      isCells(x.solution, 1, 9) &&
      isCells(x.values, 0, 9) &&
      isMasks(x.notes) &&
      isInt(x.mistakes, 0, MISTAKES_ALLOWED) &&
      isInt(x.seconds, 0, LIMITS.seconds) &&
      isInt(x.hintsUsed, 0, LIMITS.hintsUsed) &&
      (x.status === "playing" || x.status === "won" || x.status === "lost") &&
      isDate(x.dateKey) &&
      (x.attempt === undefined || isInt(x.attempt, 0, LIMITS.attempt)) &&
      (x.hintElims === undefined || isMasks(x.hintElims))
    )
  )
    return false;
  const g = x as unknown as SavedGame;
  for (let i = 0; i < 81; i++) {
    // Givens agree with the solution and stay in place.
    if (g.puzzle[i] && (g.puzzle[i] !== g.solution[i] || g.values[i] !== g.puzzle[i])) return false;
    // Hint eliminations are facts about the solution: they may never rule out the answer.
    if (g.hintElims && g.hintElims[i] & (1 << g.solution[i])) return false;
  }
  // Status must agree with the board.
  const solved = g.values.every((v, i) => v === g.solution[i]);
  if (g.status === "won" && !solved) return false;
  if (g.status === "lost" && g.mistakes < MISTAKES_ALLOWED) return false;
  if (g.status === "playing" && (solved || g.mistakes >= MISTAKES_ALLOWED)) return false;
  return true;
}

function isSolve(x: unknown): x is Solve {
  return (
    isObj(x) &&
    isDate(x.date) &&
    DIFFS.includes(x.difficulty as Difficulty) &&
    isInt(x.seconds, 0, LIMITS.seconds) &&
    isInt(x.mistakes, 0, MISTAKES_ALLOWED) &&
    typeof x.daily === "boolean"
  );
}

function isDrillRecord(v: unknown): boolean {
  return (
    isObj(v) &&
    isInt(v.attempted, 0, LIMITS.drillCount) &&
    isInt(v.correct, 0, LIMITS.drillCount) &&
    (v.correct as number) <= (v.attempted as number)
  );
}

/**
 * Returns a valid store, or null if the value does not have the v1 shape.
 * A single bad saved game is dropped on its own, so it cannot wipe the streak and stats.
 */
export function parseStore(raw: unknown): NonetStore | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const { playedDays, solves, games, drills, drillsByDay, reviewedDaily } = raw;
  if (!Array.isArray(playedDays) || !playedDays.every(isDate)) return null;
  if (!Array.isArray(solves) || !solves.every(isSolve)) return null;
  if (!isObj(games)) return null;
  if (!isObj(drills)) return null;
  for (const [k, v] of Object.entries(drills)) {
    if (!TECHNIQUE_ORDER.includes(k as Technique) || !isDrillRecord(v)) return null;
  }
  if (!isObj(drillsByDay) || !Object.entries(drillsByDay).every(([k, v]) => isDate(k) && isInt(v, 0, LIMITS.drillCount)))
    return null;
  if (!Array.isArray(reviewedDaily) || !reviewedDaily.every(isDate)) return null;
  const store = raw as unknown as NonetStore;
  const cleanGames: NonetStore["games"] = {};
  if (isSavedGame(games.daily) && games.daily.daily) cleanGames.daily = games.daily;
  if (isSavedGame(games.quick) && !games.quick.daily) cleanGames.quick = games.quick;
  return { ...store, games: cleanGames };
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

/** The stored value, defaults if missing or invalid, or null if storage cannot be read at all. */
function tryReadStorage(): NonetStore | null {
  if (memoryOnly) return null;
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
    return null;
  }
}

function readStorage(): NonetStore {
  return tryReadStorage() ?? cache ?? defaultStore();
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
  // Start from what is stored now, not this tab's cached copy, so another tab's
  // changes (a win, a solve, drill counts) are never written over with stale data.
  const fresh = tryReadStorage();
  if (fresh) cache = fresh;
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
