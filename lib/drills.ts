// Positions rebuilt from engine output: the grid and candidates just before a step.

import { PEERS, initCands, type Cands, type Grid, type Step } from "./engine";

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
