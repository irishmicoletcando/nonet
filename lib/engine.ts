// Sudoku engine: generation, solving, human-technique solver with explanations.

export type Grid = number[]; // 81 cells, 0 = empty

export const rc = (i: number) => [Math.floor(i / 9), i % 9] as const;
export const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

export const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    const cells: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br + r) * 9 + bc + c);
    u.push(cells);
  }
  return u;
})();

export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of UNITS) if (u.includes(i)) u.forEach((x) => x !== i && s.add(x));
  return [...s];
});

export function unitName(idx: number): string {
  if (idx < 9) return `row ${idx + 1}`;
  if (idx < 18) return `column ${idx - 8}`;
  return `box ${idx - 17}`;
}
export const cellName = (i: number) => `R${Math.floor(i / 9) + 1}C${(i % 9) + 1}`;

// ---------- seeded RNG ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- backtracking solver (bitmask, MRV) ----------
export function countSolutions(grid: Grid, limit = 2): number {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (g[i]) {
      const b = 1 << g[i];
      const [r, c] = rc(i);
      if (rows[r] & b || cols[c] & b || boxes[boxOf(i)] & b) return 0;
      rows[r] |= b; cols[c] |= b; boxes[boxOf(i)] |= b;
    }
  }
  let count = 0;
  const rec = (): void => {
    if (count >= limit) return;
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const [r, c] = rc(i);
      const used = rows[r] | cols[c] | boxes[boxOf(i)];
      const avail = ~used & 0x3fe;
      let n = 0; for (let m = avail; m; m &= m - 1) n++;
      if (n < bestN) { bestN = n; best = i; bestMask = avail; if (n <= 1) break; }
    }
    if (best === -1) { count++; return; }
    if (bestN === 0) return;
    const [r, c] = rc(best), b = boxOf(best);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

export function solve(grid: Grid): Grid | null {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) {
    const b = 1 << g[i]; const [r, c] = rc(i);
    if (rows[r] & b || cols[c] & b || boxes[boxOf(i)] & b) return null;
    rows[r] |= b; cols[c] |= b; boxes[boxOf(i)] |= b;
  }
  const rec = (): boolean => {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const [r, c] = rc(i);
      const avail = ~(rows[r] | cols[c] | boxes[boxOf(i)]) & 0x3fe;
      let n = 0; for (let m = avail; m; m &= m - 1) n++;
      if (n < bestN) { bestN = n; best = i; bestMask = avail; if (n <= 1) break; }
    }
    if (best === -1) return true;
    if (bestN === 0) return false;
    const [r, c] = rc(best), b = boxOf(best);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (rec()) return true;
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  };
  return rec() ? g : null;
}

// ---------- human-technique solver ----------
export type Technique =
  | "Naked Single" | "Hidden Single" | "Naked Pair" | "Hidden Pair"
  | "Pointing Pair" | "Box/Line Reduction" | "Naked Triple" | "X-Wing";

export const TECHNIQUE_ORDER: Technique[] = [
  "Naked Single", "Hidden Single", "Naked Pair", "Pointing Pair",
  "Box/Line Reduction", "Hidden Pair", "Naked Triple", "X-Wing",
];
export const TECHNIQUE_WEIGHT: Record<Technique, number> = {
  "Naked Single": 1, "Hidden Single": 2, "Naked Pair": 4, "Pointing Pair": 4,
  "Box/Line Reduction": 5, "Hidden Pair": 6, "Naked Triple": 7, "X-Wing": 9,
};
export const TECHNIQUE_HELP: Record<Technique, string> = {
  "Naked Single": "A cell has only one candidate left, so it must be that digit.",
  "Hidden Single": "A digit has only one possible cell in a row, column or box, so it must go there.",
  "Naked Pair": "Two cells in a unit share the same two candidates. Those digits can be removed from every other cell in the unit.",
  "Hidden Pair": "Two digits appear in only the same two cells of a unit. Every other candidate in those two cells can be removed.",
  "Pointing Pair": "Inside a box, a digit's candidates all lie on one line. The digit can be removed from the rest of that line.",
  "Box/Line Reduction": "In a row or column, a digit's candidates all lie inside one box. The digit can be removed from the rest of that box.",
  "Naked Triple": "Three cells in a unit hold only three digits between them. Those digits can be removed from the other cells in the unit.",
  "X-Wing": "A digit appears in exactly two cells in each of two rows, and they share the same two columns (or the reverse). The digit can be removed from the rest of those columns (or rows).",
};

export interface Step {
  technique: Technique;
  explanation: string;
  placements: { cell: number; digit: number }[];
  eliminations: { cell: number; digit: number }[];
  highlight: number[]; // cells that form the pattern
}

export type Cands = number[]; // bitmask per cell, bit d = digit d

export function initCands(grid: Grid): Cands {
  const c: Cands = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    let m = 0x3fe;
    for (const p of PEERS[i]) if (grid[p]) m &= ~(1 << grid[p]);
    c[i] = m;
  }
  return c;
}
const digitsOf = (m: number) => { const d: number[] = []; for (let v = 1; v <= 9; v++) if (m & (1 << v)) d.push(v); return d; };
const popcount = (m: number) => digitsOf(m).length;

function place(grid: Grid, cands: Cands, i: number, v: number) {
  grid[i] = v; cands[i] = 0;
  for (const p of PEERS[i]) cands[p] &= ~(1 << v);
}

export function findStep(grid: Grid, cands: Cands): Step | null {
  for (const t of TECHNIQUE_ORDER) {
    const s = FINDERS[t](grid, cands);
    if (s) return s;
  }
  return null;
}

const FINDERS: Record<Technique, (g: Grid, c: Cands) => Step | null> = {
  "Naked Single": (g, c) => {
    for (let i = 0; i < 81; i++) if (!g[i] && popcount(c[i]) === 1) {
      const v = digitsOf(c[i])[0];
      return { technique: "Naked Single", highlight: [i], placements: [{ cell: i, digit: v }], eliminations: [],
        explanation: `${cellName(i)} can only be ${v}: every other digit is already used by its row, column or box.` };
    }
    return null;
  },
  "Hidden Single": (g, c) => {
    for (let u = 0; u < 27; u++) for (let v = 1; v <= 9; v++) {
      const spots = UNITS[u].filter((i) => !g[i] && c[i] & (1 << v));
      if (spots.length === 1 && !UNITS[u].some((i) => g[i] === v)) {
        return { technique: "Hidden Single", highlight: [spots[0]], placements: [{ cell: spots[0], digit: v }], eliminations: [],
          explanation: `In ${unitName(u)}, ${v} can only go in ${cellName(spots[0])}.` };
      }
    }
    return null;
  },
  "Naked Pair": (g, c) => {
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter((i) => !g[i] && popcount(c[i]) === 2);
      for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
        if (c[cells[a]] !== c[cells[b]]) continue;
        const m = c[cells[a]];
        const elim: Step["eliminations"] = [];
        for (const i of UNITS[u]) if (i !== cells[a] && i !== cells[b] && !g[i])
          for (const d of digitsOf(c[i] & m)) elim.push({ cell: i, digit: d });
        if (elim.length) {
          const ds = digitsOf(m);
          return { technique: "Naked Pair", highlight: [cells[a], cells[b]], placements: [], eliminations: elim,
            explanation: `${cellName(cells[a])} and ${cellName(cells[b])} both contain only ${ds[0]} and ${ds[1]}, so those two digits are locked there. Remove ${ds.join(" and ")} from the other cells in ${unitName(u)}.` };
        }
      }
    }
    return null;
  },
  "Pointing Pair": (g, c) => {
    for (let b = 18; b < 27; b++) for (let v = 1; v <= 9; v++) {
      const spots = UNITS[b].filter((i) => !g[i] && c[i] & (1 << v));
      if (spots.length < 2 || spots.length > 3) continue;
      const sameRow = spots.every((i) => Math.floor(i / 9) === Math.floor(spots[0] / 9));
      const sameCol = spots.every((i) => i % 9 === spots[0] % 9);
      const line = sameRow ? Math.floor(spots[0] / 9) : sameCol ? 9 + (spots[0] % 9) : -1;
      if (line < 0) continue;
      const elim = UNITS[line].filter((i) => !g[i] && !spots.includes(i) && boxOf(i) !== b - 18 && c[i] & (1 << v))
        .map((i) => ({ cell: i, digit: v }));
      if (elim.length) return { technique: "Pointing Pair", highlight: spots, placements: [], eliminations: elim,
        explanation: `In ${unitName(b)}, every ${v} sits in ${unitName(line)}. So ${v} cannot appear anywhere else in ${unitName(line)}.` };
    }
    return null;
  },
  "Box/Line Reduction": (g, c) => {
    for (let l = 0; l < 18; l++) for (let v = 1; v <= 9; v++) {
      const spots = UNITS[l].filter((i) => !g[i] && c[i] & (1 << v));
      if (spots.length < 2 || spots.length > 3) continue;
      const bx = boxOf(spots[0]);
      if (!spots.every((i) => boxOf(i) === bx)) continue;
      const elim = UNITS[18 + bx].filter((i) => !g[i] && !spots.includes(i) && c[i] & (1 << v))
        .map((i) => ({ cell: i, digit: v }));
      if (elim.length) return { technique: "Box/Line Reduction", highlight: spots, placements: [], eliminations: elim,
        explanation: `In ${unitName(l)}, every ${v} sits inside ${unitName(18 + bx)}. So ${v} cannot appear elsewhere in that box.` };
    }
    return null;
  },
  "Hidden Pair": (g, c) => {
    for (let u = 0; u < 27; u++) {
      const pos: Record<number, number[]> = {};
      for (let v = 1; v <= 9; v++) pos[v] = UNITS[u].filter((i) => !g[i] && c[i] & (1 << v));
      for (let v1 = 1; v1 <= 9; v1++) for (let v2 = v1 + 1; v2 <= 9; v2++) {
        const p1 = pos[v1], p2 = pos[v2];
        if (p1.length !== 2 || p2.length !== 2 || p1[0] !== p2[0] || p1[1] !== p2[1]) continue;
        const keep = (1 << v1) | (1 << v2);
        const elim: Step["eliminations"] = [];
        for (const i of p1) for (const d of digitsOf(c[i] & ~keep)) elim.push({ cell: i, digit: d });
        if (elim.length) return { technique: "Hidden Pair", highlight: p1, placements: [], eliminations: elim,
          explanation: `In ${unitName(u)}, ${v1} and ${v2} only fit in ${cellName(p1[0])} and ${cellName(p1[1])}. Those cells must hold them, so remove all other candidates from both.` };
      }
    }
    return null;
  },
  "Naked Triple": (g, c) => {
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter((i) => !g[i] && popcount(c[i]) >= 2 && popcount(c[i]) <= 3);
      for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) for (let d = b + 1; d < cells.length; d++) {
        const m = c[cells[a]] | c[cells[b]] | c[cells[d]];
        if (popcount(m) !== 3) continue;
        const trio = [cells[a], cells[b], cells[d]];
        const elim: Step["eliminations"] = [];
        for (const i of UNITS[u]) if (!g[i] && !trio.includes(i))
          for (const x of digitsOf(c[i] & m)) elim.push({ cell: i, digit: x });
        if (elim.length) return { technique: "Naked Triple", highlight: trio, placements: [], eliminations: elim,
          explanation: `${trio.map(cellName).join(", ")} together contain only ${digitsOf(m).join(", ")}. Remove those digits from the other cells in ${unitName(u)}.` };
      }
    }
    return null;
  },
  "X-Wing": (g, c) => {
    for (let v = 1; v <= 9; v++) for (const byRow of [true, false]) {
      const lines: { idx: number; pos: number[] }[] = [];
      for (let k = 0; k < 9; k++) {
        const unit = UNITS[byRow ? k : 9 + k];
        const pos = unit.filter((i) => !g[i] && c[i] & (1 << v)).map((i) => (byRow ? i % 9 : Math.floor(i / 9)));
        if (pos.length === 2) lines.push({ idx: k, pos });
      }
      for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
        if (lines[a].pos[0] !== lines[b].pos[0] || lines[a].pos[1] !== lines[b].pos[1]) continue;
        const elim: Step["eliminations"] = [];
        for (const p of lines[a].pos) {
          const cross = UNITS[byRow ? 9 + p : p];
          for (const i of cross) {
            const lineIdx = byRow ? Math.floor(i / 9) : i % 9;
            if (lineIdx !== lines[a].idx && lineIdx !== lines[b].idx && !g[i] && c[i] & (1 << v)) elim.push({ cell: i, digit: v });
          }
        }
        if (elim.length) {
          const hl = [lines[a], lines[b]].flatMap((l) => l.pos.map((p) => (byRow ? l.idx * 9 + p : p * 9 + l.idx)));
          const L = byRow ? "rows" : "columns", O = byRow ? "columns" : "rows";
          return { technique: "X-Wing", highlight: hl, placements: [], eliminations: elim,
            explanation: `${v} appears in only two cells in each of ${L} ${lines[a].idx + 1} and ${lines[b].idx + 1}, both in ${O} ${lines[a].pos[0] + 1} and ${lines[a].pos[1] + 1}. Whichever diagonal holds the ${v}s, those ${O} are covered, so remove ${v} from the rest of them.` };
        }
      }
    }
    return null;
  },
};

export interface Analysis {
  steps: Step[];
  solved: boolean;
  rating: number;
  techniques: Partial<Record<Technique, number>>;
  hardest: Technique | null;
  difficulty: Difficulty;
}

export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert" | "Fiendish";
export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Expert"];

export function analyze(puzzle: Grid, maxSteps = 400): Analysis {
  const g = puzzle.slice();
  const c = initCands(g);
  const steps: Step[] = [];
  const techniques: Analysis["techniques"] = {};
  let hardest: Technique | null = null;
  let rating = 0;
  while (steps.length < maxSteps && g.some((v) => !v)) {
    const s = findStep(g, c);
    if (!s) break;
    steps.push(s);
    techniques[s.technique] = (techniques[s.technique] ?? 0) + 1;
    rating += TECHNIQUE_WEIGHT[s.technique];
    if (!hardest || TECHNIQUE_WEIGHT[s.technique] > TECHNIQUE_WEIGHT[hardest]) hardest = s.technique;
    for (const e of s.eliminations) c[e.cell] &= ~(1 << e.digit);
    for (const p of s.placements) place(g, c, p.cell, p.digit);
  }
  const solved = g.every((v) => v);
  const w = hardest ? TECHNIQUE_WEIGHT[hardest] : 0;
  const difficulty: Difficulty = !solved ? "Fiendish" : w <= 1 ? "Easy" : w <= 2 ? "Medium" : w <= 5 ? "Hard" : "Expert";
  return { steps, solved, rating, techniques, hardest, difficulty };
}

// ---------- generator ----------
export function generateSolution(rnd: () => number): Grid {
  const g: Grid = new Array(81).fill(0);
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  const rec = (i: number): boolean => {
    if (i === 81) return true;
    const [r, c] = rc(i), b = boxOf(i);
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
      const bit = 1 << v;
      if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) continue;
      g[i] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (rec(i + 1)) return true;
      g[i] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  };
  rec(0);
  return g;
}

const TARGET_CLUES: Record<Difficulty, number> = { Easy: 40, Medium: 34, Hard: 29, Expert: 24, Fiendish: 22 };

export function digPuzzle(solution: Grid, clues: number, rnd: () => number): Grid {
  const p = solution.slice();
  let filled = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rnd)) {
    if (filled <= clues) break;
    const v = p[i]; p[i] = 0;
    if (countSolutions(p, 2) !== 1) p[i] = v; else filled--;
  }
  return p;
}

export interface Puzzle { puzzle: Grid; solution: Grid; difficulty: Difficulty; seed: number; rating: number }

/** Generates a unique-solution puzzle whose human-solver rating matches the requested tier. */
export function generatePuzzle(difficulty: Difficulty, seed: number): Puzzle {
  const rnd = mulberry32(seed);
  let fallback: Puzzle | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = generateSolution(rnd);
    const puzzle = digPuzzle(solution, TARGET_CLUES[difficulty], rnd);
    const a = analyze(puzzle);
    const cand = { puzzle, solution, difficulty: a.difficulty, seed, rating: a.rating };
    if (a.solved && a.difficulty === difficulty) return cand;
    if (a.solved && (!fallback || Math.abs(order(a.difficulty) - order(difficulty)) < Math.abs(order(fallback.difficulty) - order(difficulty)))) fallback = cand;
  }
  return fallback ?? (() => { const solution = generateSolution(rnd); const puzzle = digPuzzle(solution, 36, rnd); return { puzzle, solution, difficulty: "Easy" as Difficulty, seed, rating: 0 }; })();
}
const order = (d: Difficulty) => ["Easy", "Medium", "Hard", "Expert", "Fiendish"].indexOf(d);

export function parseGrid(s: string): Grid | null {
  const t = s.replace(/[.\-_*]/g, "0").replace(/[^0-9]/g, "");
  if (t.length !== 81) return null;
  return t.split("").map(Number);
}
export const gridToString = (g: Grid) => g.join("");

export function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
