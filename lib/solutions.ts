// A solution counter with a work budget, for running on the main thread without
// risking a freeze. Same bitmask + fewest-candidates search as the engine's
// countSolutions, plus a node counter that stops the search when it runs out.

import { boxOf, type Grid } from "./engine";

export interface BudgetedCount {
  /** Solutions found, capped at `limit`. Only meaningful when `complete`. */
  count: number;
  /** False when the budget ran out before the answer was known. */
  complete: boolean;
}

export function countSolutionsBudget(grid: Grid, limit: number, maxNodes: number): BudgetedCount {
  const g = grid.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const b = 1 << g[i];
    const r = Math.floor(i / 9);
    const c = i % 9;
    if (rows[r] & b || cols[c] & b || boxes[boxOf(i)] & b) return { count: 0, complete: true };
    rows[r] |= b;
    cols[c] |= b;
    boxes[boxOf(i)] |= b;
  }
  let count = 0;
  let nodes = 0;
  let outOfBudget = false;
  const rec = (): void => {
    if (count >= limit || outOfBudget) return;
    if (++nodes > maxNodes) {
      outOfBudget = true;
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const avail = ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]) & 0x3fe;
      let n = 0;
      for (let m = avail; m; m &= m - 1) n++;
      if (n < bestN) {
        bestN = n;
        best = i;
        bestMask = avail;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      return;
    }
    if (bestN === 0) return;
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(best);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      rec();
      g[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (count >= limit || outOfBudget) return;
    }
  };
  rec();
  return { count, complete: !outOfBudget };
}
