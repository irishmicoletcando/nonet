// Pure game logic for Play: a reducer over the saved-game shape, plus hint helpers.

import {
  PEERS,
  UNITS,
  boxOf,
  findStep,
  initCands,
  unitName,
  type Puzzle,
  type Step,
} from "./engine";
import { MISTAKES_ALLOWED } from "./constants";
import type { SavedGame } from "./storage";

interface Snapshot {
  values: number[];
  notes: number[];
}

export interface GameState {
  game: SavedGame;
  /** Undo stack of value/notes changes. Not persisted. */
  history: Snapshot[];
}

export type GameAction =
  | { type: "input"; cell: number; digit: number; notesMode: boolean }
  | { type: "erase"; cell: number }
  | { type: "undo" }
  | { type: "tick" }
  | { type: "hint" }
  | { type: "restart" };

const HISTORY_MAX = 200;

export function newGame(p: Puzzle, daily: boolean, dateKey: string): SavedGame {
  return {
    seed: p.seed,
    difficulty: p.difficulty,
    daily,
    puzzle: p.puzzle.slice(),
    solution: p.solution.slice(),
    values: p.puzzle.slice(),
    notes: new Array(81).fill(0),
    mistakes: 0,
    seconds: 0,
    status: "playing",
    hintsUsed: 0,
    dateKey,
  };
}

export function initState(game: SavedGame): GameState {
  return { game, history: [] };
}

function push(state: GameState): Snapshot[] {
  const h = [...state.history, { values: state.game.values, notes: state.game.notes }];
  return h.length > HISTORY_MAX ? h.slice(-HISTORY_MAX) : h;
}

const isComplete = (g: SavedGame) => g.values.every((v, i) => v === g.solution[i]);

export function gameReducer(state: GameState, action: GameAction): GameState {
  const g = state.game;
  switch (action.type) {
    case "input": {
      const { cell, digit, notesMode } = action;
      if (g.status !== "playing" || g.puzzle[cell] !== 0 || digit < 1 || digit > 9) return state;
      if (notesMode) {
        if (g.values[cell] !== 0) return state;
        const notes = g.notes.slice();
        notes[cell] ^= 1 << digit;
        return { game: { ...g, notes }, history: push(state) };
      }
      if (g.values[cell] === digit) return state;
      const values = g.values.slice();
      const notes = g.notes.slice();
      values[cell] = digit;
      notes[cell] = 0;
      let mistakes = g.mistakes;
      let status: SavedGame["status"] = g.status;
      if (digit !== g.solution[cell]) {
        mistakes += 1;
        if (mistakes >= MISTAKES_ALLOWED) status = "lost";
      } else {
        for (const p of PEERS[cell]) notes[p] &= ~(1 << digit);
      }
      const next: SavedGame = { ...g, values, notes, mistakes, status };
      if (status === "playing" && isComplete(next)) next.status = "won";
      return { game: next, history: push(state) };
    }
    case "erase": {
      const { cell } = action;
      if (g.status !== "playing" || g.puzzle[cell] !== 0) return state;
      if (g.values[cell] === 0 && g.notes[cell] === 0) return state;
      const values = g.values.slice();
      const notes = g.notes.slice();
      values[cell] = 0;
      notes[cell] = 0;
      return { game: { ...g, values, notes }, history: push(state) };
    }
    case "undo": {
      if (g.status !== "playing" || state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return { game: { ...g, values: prev.values, notes: prev.notes }, history: state.history.slice(0, -1) };
    }
    case "tick":
      if (g.status !== "playing") return state;
      return { ...state, game: { ...g, seconds: g.seconds + 1 } };
    case "hint":
      if (g.status !== "playing") return state;
      return { ...state, game: { ...g, hintsUsed: g.hintsUsed + 1 } };
    case "restart":
      return {
        game: {
          ...g,
          values: g.puzzle.slice(),
          notes: new Array(81).fill(0),
          mistakes: 0,
          seconds: 0,
          status: "playing",
          hintsUsed: 0,
        },
        history: [],
      };
  }
}

/** Non-given cells whose value differs from the solution. */
export function wrongCells(g: SavedGame): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) if (g.values[i] && !g.puzzle[i] && g.values[i] !== g.solution[i]) out.push(i);
  return out;
}

/** remaining[d] = 9 minus every placed instance of d (right or wrong), for d = 1..9. Index 0 unused. */
export function remainingCounts(values: number[]): number[] {
  const r = new Array(10).fill(9);
  r[0] = 0;
  for (const v of values) if (v) r[v] -= 1;
  return r.map((n) => Math.max(0, n));
}

/** Clock as mm:ss (minutes keep growing past 99). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- hints ----------

export type Hint =
  | { kind: "wrong" }
  | { kind: "none" }
  | { kind: "step"; step: Step; region: string };

/**
 * The area to look in, without naming the cell. A unit that holds every pattern cell,
 * preferring the box; singles always use the box. X-Wing names its two base rows or columns.
 */
export function hintRegion(step: Step): string {
  const cells = step.highlight;
  if (step.technique === "X-Wing") {
    const rows = [...new Set(cells.map((i) => Math.floor(i / 9)))].sort((a, b) => a - b);
    const cols = [...new Set(cells.map((i) => i % 9))].sort((a, b) => a - b);
    // Eliminations lie in the cover lines; the base lines are the other pair.
    const elimInPatternCols = step.eliminations.every((e) => cols.includes(e.cell % 9));
    return elimInPatternCols
      ? `rows ${rows[0] + 1} and ${rows[1] + 1}`
      : `columns ${cols[0] + 1} and ${cols[1] + 1}`;
  }
  if (cells.length === 1) return unitName(18 + boxOf(cells[0]));
  const containing = UNITS.map((u, idx) => ({ u, idx })).filter(({ u }) => cells.every((c) => u.includes(c)));
  const box = containing.find(({ idx }) => idx >= 18);
  const pick = box ?? containing[0];
  return pick ? unitName(pick.idx) : unitName(18 + boxOf(cells[0]));
}

/** Next logical step from the current position, with wrong digits ignored. */
export function computeHint(g: SavedGame): Hint {
  if (wrongCells(g).length > 0) return { kind: "wrong" };
  const grid = g.values.slice();
  const step = findStep(grid, initCands(grid));
  if (!step) return { kind: "none" };
  return { kind: "step", step, region: hintRegion(step) };
}
