"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { boxOf, cellName } from "@/lib/engine";
import { Candidates } from "./Candidates";
import styles from "./Board.module.css";

export interface CellDigit {
  cell: number;
  digit: number;
}

export interface BoardProps {
  /** 81 values, 0 = empty. */
  values: number[];
  /** 81 flags: true = given clue. */
  givens: boolean[];
  /** 81 candidate bitmasks (engine Cands format, bit d = digit d). */
  notes?: number[];
  selected?: number | null;
  /** Cells painted yellow (review pattern, trainer selection). */
  pattern?: number[];
  /** Cell painted pink, that candidate struck through. */
  eliminations?: CellDigit[];
  /** Placements shown as a light preview digit (review). */
  ghosts?: CellDigit[];
  /** Cells whose digit is wrong (shown in error red). */
  wrong?: number[];
  onSelect?: (cell: number) => void;
  /** Digit 1-9 typed while the board has focus. */
  onInput?: (digit: number) => void;
  onErase?: () => void;
  onToggleNotes?: () => void;
  /**
   * When true (default), arrow keys move the selection itself (Play, Review).
   * When false, arrows only move focus and Enter/Space/click call onSelect (Trainer toggling).
   */
  selectionFollowsFocus?: boolean;
  /** Max width in px. Default 540. */
  size?: number;
  /** Accessible name for the grid. */
  label: string;
}

type Bg = "selected" | "pattern" | "elim" | "same" | "peer" | undefined;

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function isPeer(a: number, b: number) {
  return Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 || boxOf(a) === boxOf(b);
}

function digitsOfMask(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
}

export function Board({
  values,
  givens,
  notes,
  selected = null,
  pattern,
  eliminations,
  ghosts,
  wrong,
  onSelect,
  onInput,
  onErase,
  onToggleNotes,
  selectionFollowsFocus = true,
  size = 540,
  label,
}: BoardProps) {
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const interactive = Boolean(onSelect);

  // Roving tabindex: exactly one cell is tabbable. It follows the selection when there is one.
  const [cursor, setCursor] = useState<number>(selected ?? 0);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected !== null && selected !== undefined) setCursor(selected);
  }

  const sets = useMemo(() => {
    const patternSet = new Set(pattern ?? []);
    const wrongSet = new Set(wrong ?? []);
    const struck = new Map<number, number>();
    for (const e of eliminations ?? []) struck.set(e.cell, (struck.get(e.cell) ?? 0) | (1 << e.digit));
    const ghost = new Map<number, number>();
    for (const g of ghosts ?? []) ghost.set(g.cell, g.digit);
    return { patternSet, wrongSet, struck, ghost };
  }, [pattern, wrong, eliminations, ghosts]);

  const selValue = selected !== null && selected !== undefined ? values[selected] : 0;

  function background(i: number): Bg {
    if (selected === i) return "selected";
    if (sets.patternSet.has(i)) return "pattern";
    if (sets.struck.has(i)) return "elim";
    if (selected !== null && selected !== undefined) {
      if (selValue && values[i] === selValue) return "same";
      if (isPeer(i, selected)) return "peer";
    }
    return undefined;
  }

  function cellLabel(i: number): string {
    const parts = [cellName(i)];
    const v = values[i];
    if (v) {
      parts.push(String(v));
      if (givens[i]) parts.push("given");
      else if (sets.wrongSet.has(i)) parts.push("wrong");
    } else {
      parts.push("empty");
      const ghost = sets.ghost.get(i);
      if (ghost) parts.push(`place ${ghost}`);
      const mask = notes?.[i] ?? 0;
      if (mask) parts.push(`candidates ${digitsOfMask(mask).join(" ")}`);
    }
    const struck = sets.struck.get(i);
    if (struck) parts.push(`remove ${digitsOfMask(struck).join(" ")}`);
    if (sets.patternSet.has(i) && selected !== i) parts.push("highlighted");
    return parts.join(", ");
  }

  function focusCell(i: number) {
    setCursor(i);
    cellRefs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const from = cursor;
    const r = Math.floor(from / 9);
    const c = from % 9;
    let next = -1;
    switch (e.key) {
      case "ArrowUp":
        next = r > 0 ? from - 9 : from;
        break;
      case "ArrowDown":
        next = r < 8 ? from + 9 : from;
        break;
      case "ArrowLeft":
        next = c > 0 ? from - 1 : from;
        break;
      case "ArrowRight":
        next = c < 8 ? from + 1 : from;
        break;
      case "Backspace":
      case "Delete":
        if (onErase) {
          e.preventDefault();
          onErase();
        }
        return;
      case "n":
      case "N":
        if (onToggleNotes) {
          e.preventDefault();
          onToggleNotes();
        }
        return;
      default:
        if (/^[1-9]$/.test(e.key) && onInput) {
          e.preventDefault();
          onInput(Number(e.key));
        }
        return;
    }
    // Arrow key
    e.preventDefault();
    if (next === from) return; // stop at edges
    focusCell(next);
    if (selectionFollowsFocus) onSelect?.(next);
  }

  const style = { "--board-size": `${size}px` } as CSSProperties;

  return (
    <div className={styles.frame} style={style}>
      <div
        role="grid"
        aria-label={label}
        aria-readonly={onInput ? undefined : true}
        className={styles.grid}
        onKeyDown={interactive ? onKeyDown : undefined}
      >
        {ROWS.map((r) => (
          <div role="row" key={r} className={styles.row}>
            {ROWS.map((c) => {
              const i = r * 9 + c;
              const v = values[i];
              const bg = background(i);
              const className = [
                styles.cell,
                c === 2 || c === 5 ? styles.boxRight : "",
                c === 8 ? styles.lastCol : "",
                r === 2 || r === 5 ? styles.boxBottom : "",
                r === 8 ? styles.lastRow : "",
              ]
                .filter(Boolean)
                .join(" ");

              let content = null;
              if (v) {
                const kind = givens[i] ? styles.given : sets.wrongSet.has(i) ? styles.wrong : styles.user;
                content = (
                  <span className={kind} aria-hidden="true">
                    {v}
                  </span>
                );
              } else if (sets.ghost.has(i)) {
                content = (
                  <span className={styles.ghost} aria-hidden="true">
                    {sets.ghost.get(i)}
                  </span>
                );
              } else if ((notes?.[i] ?? 0) || sets.struck.has(i)) {
                content = <Candidates mask={notes?.[i] ?? 0} struck={sets.struck.get(i) ?? 0} />;
              }

              if (!interactive) {
                return (
                  <div key={c} role="gridcell" aria-label={cellLabel(i)} className={className} data-bg={bg}>
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={c}
                  ref={(el) => {
                    cellRefs.current[i] = el;
                  }}
                  type="button"
                  role="gridcell"
                  aria-label={cellLabel(i)}
                  aria-selected={selectionFollowsFocus ? selected === i : sets.patternSet.has(i)}
                  tabIndex={cursor === i ? 0 : -1}
                  className={className}
                  data-bg={bg}
                  data-interactive=""
                  onClick={() => {
                    focusCell(i);
                    onSelect?.(i);
                  }}
                  onFocus={() => {
                    setCursor(i);
                    if (selectionFollowsFocus && (selected === null || selected === undefined)) onSelect?.(i);
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
