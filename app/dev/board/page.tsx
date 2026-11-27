"use client";

// Dev-only Board preview for the M2 review. Removed in M8.

import { useState } from "react";
import { Board, type CellDigit } from "@/components/board/Board";
import {
  PEERS,
  analyze,
  generatePuzzle,
  initCands,
  parseGrid,
  solve,
  type Grid,
  type Step,
} from "@/lib/engine";

// ---------- fixtures ----------

/** Grid and candidates just before `steps[k]`, replaying earlier steps. */
function stateBefore(puzzle: Grid, steps: Step[], k: number) {
  const grid = puzzle.slice();
  const cands = initCands(grid);
  for (const s of steps.slice(0, k)) {
    for (const e of s.eliminations) cands[e.cell] &= ~(1 << e.digit);
    for (const p of s.placements) {
      grid[p.cell] = p.digit;
      cands[p.cell] = 0;
      for (const q of PEERS[p.cell]) cands[q] &= ~(1 << p.digit);
    }
  }
  return { grid, cands };
}

function reviewFixture() {
  const { puzzle } = generatePuzzle("Hard", 1);
  const { steps } = analyze(puzzle);
  const k = steps.findIndex((s) => s.eliminations.length > 0);
  const step = steps[k];
  const { grid, cands } = stateBefore(puzzle, steps, k);
  // Show the following placement as a ghost so all three marks appear on one board.
  const marked = new Set([...step.highlight, ...step.eliminations.map((e) => e.cell)]);
  const next = steps
    .slice(k + 1)
    .find((s) => s.placements.length > 0 && s.placements.every((p) => !marked.has(p.cell)));
  const ghosts: CellDigit[] = next ? next.placements : [];
  return {
    values: grid,
    givens: puzzle.map((v) => v !== 0),
    notes: cands,
    pattern: step.highlight,
    eliminations: step.eliminations,
    ghosts,
    caption: `Step ${k + 1}: ${step.technique}. ${step.explanation}`,
  };
}

function trainerFixture() {
  const { puzzle } = generatePuzzle("Hard", 29);
  const { steps } = analyze(puzzle);
  const k = steps.findIndex((s) => s.technique === "Box/Line Reduction");
  const { grid, cands } = stateBefore(puzzle, steps, k);
  return {
    values: grid,
    givens: puzzle.map((v) => v !== 0),
    notes: cands,
    firstPick: steps[k].highlight[0],
  };
}

const PLAY_PUZZLE = parseGrid("530070000600195000098000060800060003400803001700020006060000280000419005000080079")!;
const PLAY_SOLUTION = solve(PLAY_PUZZLE)!;

function playFixture() {
  const values = PLAY_PUZZLE.slice();
  const notes = new Array<number>(81).fill(0);
  // A few pen-blue entries (correct), one wrong digit, and two cells with pencil marks.
  for (const i of [2, 3, 10, 11, 28]) values[i] = PLAY_SOLUTION[i];
  values[18] = PLAY_SOLUTION[18] === 4 ? 3 : 4; // wrong
  const c = initCands(values);
  notes[5] = c[5];
  notes[6] = c[6];
  notes[21] = c[21];
  return { values, notes, selected: 0 };
}

const REVIEW = reviewFixture();
const TRAINER = trainerFixture();
const PLAY = playFixture();
const GIVENS = PLAY_PUZZLE.map((v) => v !== 0);

// ---------- page ----------

export default function BoardPreviewPage() {
  const [values, setValues] = useState(PLAY.values);
  const [notes, setNotes] = useState(PLAY.notes);
  const [selected, setSelected] = useState<number | null>(PLAY.selected);
  const [notesMode, setNotesMode] = useState(false);
  const [picked, setPicked] = useState<number[]>([TRAINER.firstPick]);
  const [reviewSel, setReviewSel] = useState<number | null>(null);

  const wrong = values.flatMap((v, i) => (v && !GIVENS[i] && v !== PLAY_SOLUTION[i] ? [i] : []));

  function input(d: number) {
    if (selected === null || GIVENS[selected]) return;
    const i = selected;
    if (notesMode) {
      if (values[i]) return;
      setNotes((n) => n.map((m, j) => (j === i ? m ^ (1 << d) : m)));
    } else {
      setValues((v) => v.map((x, j) => (j === i ? d : x)));
      setNotes((n) => n.map((m, j) => (j === i ? 0 : m)));
    }
  }

  function erase() {
    if (selected === null || GIVENS[selected]) return;
    const i = selected;
    setValues((v) => v.map((x, j) => (j === i ? 0 : x)));
    setNotes((n) => n.map((m, j) => (j === i ? 0 : m)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div className="page-head">
        <h1>Board preview</h1>
        <p>Development only. Three states of the same component.</p>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2>Play</h2>
        <p className="muted">
          Selection, peers, same digit, pen-blue entries, a wrong digit and pencil marks. Click a cell, then use
          arrows, 1 to 9, Backspace and N. Notes: {notesMode ? "on" : "off"}.
        </p>
        <Board
          label="Play preview"
          values={values}
          givens={GIVENS}
          notes={notes}
          selected={selected}
          wrong={wrong}
          onSelect={setSelected}
          onInput={input}
          onErase={erase}
          onToggleNotes={() => setNotesMode((m) => !m)}
        />
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 40 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 14, flex: "1 1 320px", maxWidth: 460 }}>
          <h2>Review</h2>
          <p className="muted">Pattern in yellow, cells losing a candidate in pink, next placement as a preview digit.</p>
          <Board
            label="Review preview"
            size={440}
            values={REVIEW.values}
            givens={REVIEW.givens}
            notes={REVIEW.notes}
            pattern={REVIEW.pattern}
            eliminations={REVIEW.eliminations}
            ghosts={REVIEW.ghosts}
            selected={reviewSel}
            onSelect={setReviewSel}
          />
          <p style={{ fontSize: 14 }}>{REVIEW.caption}</p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 14, flex: "1 1 320px", maxWidth: 460 }}>
          <h2>Trainer</h2>
          <p className="muted">Candidates on every empty cell. Tap cells to toggle them into your answer.</p>
          <Board
            label="Trainer preview"
            size={440}
            values={TRAINER.values}
            givens={TRAINER.givens}
            notes={TRAINER.notes}
            pattern={picked}
            selectionFollowsFocus={false}
            onSelect={(i) => {
              if (TRAINER.values[i]) return;
              setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
            }}
          />
        </section>
      </div>
    </div>
  );
}
