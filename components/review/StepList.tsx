"use client";

import { useEffect, useRef } from "react";
import { cellName, type Step } from "@/lib/engine";
import styles from "./Review.module.css";

/** "R1C2 = 5" for placements, "Remove 5 from R1C2, R1C3" for eliminations. */
export function describeStep(step: Step): string {
  if (step.placements.length) return step.placements.map((p) => `${cellName(p.cell)} = ${p.digit}`).join(", ");
  const byDigit = new Map<number, number[]>();
  for (const e of step.eliminations) byDigit.set(e.digit, [...(byDigit.get(e.digit) ?? []), e.cell]);
  return [...byDigit.entries()]
    .map(([d, cs], i) => `${i === 0 ? "Remove" : "remove"} ${d} from ${cs.map(cellName).join(", ")}`)
    .join("; ");
}

interface StepListProps {
  steps: Step[];
  current: number;
  onPick: (k: number) => void;
}

export function StepList({ steps, current, onPick }: StepListProps) {
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the current row visible inside the list without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !row) return;
    const top = row.offsetTop; // the list is position: relative, so it is the offset parent
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [current]);

  return (
    <div>
      <h2 className={styles.sectionTitle} id="steps-title">
        Steps, {steps.length} total
      </h2>
      <ol className={styles.steps} ref={listRef} aria-labelledby="steps-title">
        {steps.map((s, k) => (
          <li key={k}>
            <button
              type="button"
              className={styles.stepRow}
              aria-current={k === current ? "step" : undefined}
              onClick={() => onPick(k)}
            >
              <span className={styles.stepNum}>{k + 1}</span>
              <span className={styles.stepDesc}>{describeStep(s)}</span>
              <span className={styles.stepTech}>{s.technique}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
