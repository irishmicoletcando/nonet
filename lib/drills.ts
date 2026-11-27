// Drill positions built from engine output, and a validator for the user's answer.

import {
  PEERS,
  UNITS,
  analyze,
  boxOf,
  cellName,
  generatePuzzle,
  initCands,
  unitName,
  type Cands,
  type Difficulty,
  type Grid,
  type Step,
  type Technique,
} from "./engine";

export interface Position {
  grid: Grid;
  cands: Cands;
}

/** Grid and candidates just before `steps[k]`, replaying every earlier step from `initCands(puzzle)`. */
export function positionBefore(puzzle: Grid, steps: Step[], k: number): Position {
  const grid = puzzle.slice();
  const cands = initCands(grid);
  const end = Math.max(0, Math.min(k, steps.length));
  for (let s = 0; s < end; s++) {
    const step = steps[s];
    for (const e of step.eliminations) cands[e.cell] &= ~(1 << e.digit);
    for (const p of step.placements) {
      grid[p.cell] = p.digit;
      cands[p.cell] = 0;
      for (const q of PEERS[p.cell]) cands[q] &= ~(1 << p.digit);
    }
  }
  return { grid, cands };
}

// ---------- drill generation ----------

export const DRILL_SEED_CAP = 40;

/**
 * Tier to generate drills from. Measured per-seed hit rates (200 seeds):
 * Hidden Single never occurs in Easy (Easy means naked singles only) but is in 100% of Medium;
 * Box/Line Reduction is in ~9% of Hard but ~40% of Expert; Naked Triple ~8-13% and X-Wing
 * ~6% of Expert.
 */
export function difficultyFor(t: Technique): Difficulty {
  switch (t) {
    case "Naked Single":
      return "Easy";
    case "Hidden Single":
      return "Medium";
    case "Naked Pair":
    case "Pointing Pair":
      return "Hard";
    case "Box/Line Reduction":
    case "Hidden Pair":
    case "Naked Triple":
    case "X-Wing":
      return "Expert";
  }
}

export interface Drill extends Position {
  technique: Technique;
  /** Seed that produced the position. */
  seed: number;
  puzzle: Grid;
  /** The engine's step for this technique (its highlight is one correct answer). */
  step: Step;
}

/** First position, over seeds `seed .. seed + cap - 1`, where the engine's next step is `technique`. */
export function buildDrill(technique: Technique, seed: number, cap = DRILL_SEED_CAP): Drill | null {
  const difficulty = difficultyFor(technique);
  for (let s = seed; s < seed + cap; s++) {
    const { puzzle } = generatePuzzle(difficulty, s);
    const { steps } = analyze(puzzle);
    const k = steps.findIndex((st) => st.technique === technique);
    if (k < 0) continue;
    return { technique, seed: s, puzzle, step: steps[k], ...positionBefore(puzzle, steps, k) };
  }
  return null;
}

// ---------- answer validation ----------

const digitsOf = (m: number) => {
  const d: number[] = [];
  for (let v = 1; v <= 9; v++) if (m & (1 << v)) d.push(v);
  return d;
};
const popcount = (m: number) => digitsOf(m).length;
const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const sameSet = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
};

/** Indices of units (0-8 rows, 9-17 columns, 18-26 boxes) that contain every cell. */
function unitsWith(cells: number[]): number[] {
  const out: number[] = [];
  for (let u = 0; u < 27; u++) if (cells.every((c) => UNITS[u].includes(c))) out.push(u);
  return out;
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

type Elim = Step["eliminations"];

function step(technique: Technique, highlight: number[], explanation: string, eliminations: Elim, placements: Step["placements"] = []): Step {
  return { technique, explanation, eliminations, placements, highlight: [...highlight].sort((a, b) => a - b) };
}

/** Remove duplicate (cell, digit) pairs. */
function uniq(elim: Elim): Elim {
  const seen = new Set<number>();
  return elim.filter((e) => {
    const k = e.cell * 10 + e.digit;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type Validator = (g: Grid, c: Cands, sel: number[]) => Step | null;

const VALIDATORS: Record<Technique, Validator> = {
  "Naked Single": (g, c, sel) => {
    if (sel.length !== 1) return null;
    const i = sel[0];
    if (g[i] || popcount(c[i]) !== 1) return null;
    const v = digitsOf(c[i])[0];
    return step("Naked Single", sel, `${cellName(i)} can only be ${v}: every other digit is already used by its row, column or box.`, [], [
      { cell: i, digit: v },
    ]);
  },

  "Hidden Single": (g, c, sel) => {
    if (sel.length !== 1) return null;
    const i = sel[0];
    if (g[i]) return null;
    for (const u of unitsWith([i])) {
      for (const v of digitsOf(c[i])) {
        const spots = UNITS[u].filter((j) => !g[j] && c[j] & (1 << v));
        if (spots.length === 1 && spots[0] === i && !UNITS[u].some((j) => g[j] === v)) {
          return step("Hidden Single", sel, `In ${unitName(u)}, ${v} can only go in ${cellName(i)}.`, [], [{ cell: i, digit: v }]);
        }
      }
    }
    return null;
  },

  "Naked Pair": (g, c, sel) => {
    if (sel.length !== 2) return null;
    const [a, b] = sel;
    if (g[a] || g[b] || c[a] !== c[b] || popcount(c[a]) !== 2) return null;
    const m = c[a];
    const elim: Elim = [];
    const used: number[] = [];
    for (const u of unitsWith(sel)) {
      const before = elim.length;
      for (const i of UNITS[u]) if (i !== a && i !== b && !g[i]) for (const d of digitsOf(c[i] & m)) elim.push({ cell: i, digit: d });
      if (elim.length > before) used.push(u);
    }
    const all = uniq(elim);
    if (!all.length) return null;
    const ds = digitsOf(m);
    return step(
      "Naked Pair",
      sel,
      `${cellName(a)} and ${cellName(b)} both contain only ${ds[0]} and ${ds[1]}, so those two digits are locked there. Remove ${ds.join(" and ")} from the other cells in ${joinAnd(used.map(unitName))}.`,
      all,
    );
  },

  "Pointing Pair": (g, c, sel) => {
    if (sel.length < 2 || sel.length > 3 || sel.some((i) => g[i])) return null;
    const b = boxOf(sel[0]);
    if (!sel.every((i) => boxOf(i) === b)) return null;
    const line = sel.every((i) => rowOf(i) === rowOf(sel[0])) ? rowOf(sel[0]) : sel.every((i) => colOf(i) === colOf(sel[0])) ? 9 + colOf(sel[0]) : -1;
    if (line < 0) return null;
    const common = sel.reduce((m, i) => m & c[i], 0x3fe);
    for (const v of digitsOf(common)) {
      const spots = UNITS[18 + b].filter((i) => !g[i] && c[i] & (1 << v));
      if (!sameSet(spots, sel)) continue;
      const elim = UNITS[line].filter((i) => !g[i] && boxOf(i) !== b && c[i] & (1 << v)).map((i) => ({ cell: i, digit: v }));
      if (elim.length)
        return step(
          "Pointing Pair",
          sel,
          `In ${unitName(18 + b)}, every ${v} sits in ${unitName(line)}. So ${v} cannot appear anywhere else in ${unitName(line)}.`,
          elim,
        );
    }
    return null;
  },

  "Box/Line Reduction": (g, c, sel) => {
    if (sel.length < 2 || sel.length > 3 || sel.some((i) => g[i])) return null;
    const b = boxOf(sel[0]);
    if (!sel.every((i) => boxOf(i) === b)) return null;
    const lines: number[] = [];
    if (sel.every((i) => rowOf(i) === rowOf(sel[0]))) lines.push(rowOf(sel[0]));
    if (sel.every((i) => colOf(i) === colOf(sel[0]))) lines.push(9 + colOf(sel[0]));
    const common = sel.reduce((m, i) => m & c[i], 0x3fe);
    for (const l of lines) {
      for (const v of digitsOf(common)) {
        const spots = UNITS[l].filter((i) => !g[i] && c[i] & (1 << v));
        if (!sameSet(spots, sel)) continue;
        const elim = UNITS[18 + b].filter((i) => !g[i] && !sel.includes(i) && c[i] & (1 << v)).map((i) => ({ cell: i, digit: v }));
        if (elim.length)
          return step(
            "Box/Line Reduction",
            sel,
            `In ${unitName(l)}, every ${v} sits inside ${unitName(18 + b)}. So ${v} cannot appear elsewhere in that box.`,
            elim,
          );
      }
    }
    return null;
  },

  "Hidden Pair": (g, c, sel) => {
    if (sel.length !== 2) return null;
    const [a, b] = sel;
    if (g[a] || g[b]) return null;
    const common = digitsOf(c[a] & c[b]);
    for (const u of unitsWith(sel)) {
      const only = common.filter((v) => sameSet(UNITS[u].filter((i) => !g[i] && c[i] & (1 << v)), sel));
      for (let x = 0; x < only.length; x++)
        for (let y = x + 1; y < only.length; y++) {
          const v1 = only[x];
          const v2 = only[y];
          const keep = (1 << v1) | (1 << v2);
          const elim: Elim = [];
          for (const i of [a, b]) for (const d of digitsOf(c[i] & ~keep)) elim.push({ cell: i, digit: d });
          if (elim.length)
            return step(
              "Hidden Pair",
              sel,
              `In ${unitName(u)}, ${v1} and ${v2} only fit in ${cellName(a)} and ${cellName(b)}. Those cells must hold them, so remove all other candidates from both.`,
              elim,
            );
        }
    }
    return null;
  },

  "Naked Triple": (g, c, sel) => {
    if (sel.length !== 3 || sel.some((i) => g[i] || popcount(c[i]) < 2 || popcount(c[i]) > 3)) return null;
    const m = sel.reduce((acc, i) => acc | c[i], 0);
    if (popcount(m) !== 3) return null;
    const elim: Elim = [];
    const used: number[] = [];
    for (const u of unitsWith(sel)) {
      const before = elim.length;
      for (const i of UNITS[u]) if (!g[i] && !sel.includes(i)) for (const d of digitsOf(c[i] & m)) elim.push({ cell: i, digit: d });
      if (elim.length > before) used.push(u);
    }
    const all = uniq(elim);
    if (!all.length) return null;
    const sorted = [...sel].sort((p, q) => p - q);
    return step(
      "Naked Triple",
      sel,
      `${sorted.map(cellName).join(", ")} together contain only ${digitsOf(m).join(", ")}. Remove those digits from the other cells in ${joinAnd(used.map(unitName))}.`,
      all,
    );
  },

  "X-Wing": (g, c, sel) => {
    if (sel.length !== 4 || sel.some((i) => g[i])) return null;
    const rows = [...new Set(sel.map(rowOf))].sort((p, q) => p - q);
    const cols = [...new Set(sel.map(colOf))].sort((p, q) => p - q);
    if (rows.length !== 2 || cols.length !== 2) return null;
    const common = sel.reduce((m, i) => m & c[i], 0x3fe);
    for (const v of digitsOf(common)) {
      const bit = 1 << v;
      for (const byRow of [true, false]) {
        const base = byRow ? rows : cols;
        const cover = byRow ? cols : rows;
        // In each base line, v must sit only in the two cover positions.
        const fits = base.every((k) => {
          const unit = UNITS[byRow ? k : 9 + k];
          const pos = unit.filter((i) => !g[i] && c[i] & bit).map((i) => (byRow ? colOf(i) : rowOf(i)));
          return sameSet(pos, cover);
        });
        if (!fits) continue;
        const elim: Elim = [];
        for (const p of cover)
          for (const i of UNITS[byRow ? 9 + p : p]) {
            const lineIdx = byRow ? rowOf(i) : colOf(i);
            if (!base.includes(lineIdx) && !g[i] && c[i] & bit) elim.push({ cell: i, digit: v });
          }
        if (elim.length) {
          const L = byRow ? "rows" : "columns";
          const O = byRow ? "columns" : "rows";
          return step(
            "X-Wing",
            sel,
            `${v} appears in only two cells in each of ${L} ${base[0] + 1} and ${base[1] + 1}, both in ${O} ${cover[0] + 1} and ${cover[1] + 1}. Whichever diagonal holds the ${v}s, those ${O} are covered, so remove ${v} from the rest of them.`,
            elim,
          );
        }
      }
    }
    return null;
  },
};

/**
 * The instance of `technique` formed by exactly the `selected` cells in this position,
 * or null. Pattern techniques count only if they remove at least one candidate.
 */
export function checkAnswer(technique: Technique, grid: Grid, cands: Cands, selected: number[]): Step | null {
  const sel = [...new Set(selected)];
  if (sel.some((i) => i < 0 || i > 80)) return null;
  return VALIDATORS[technique](grid, cands, sel);
}

export const sameCells = sameSet;
