"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { Step } from "@/lib/engine";
import styles from "./Train.module.css";

interface ResultPanelProps {
  correct: boolean;
  /** The step that explains the result: the user's instance when correct, the engine's when not. */
  step: Step;
  /** True when a correct answer is a different valid instance from the engine's. */
  alternative: boolean;
  onNext: () => void;
}

export function ResultPanel({ correct, step, alternative, onNext }: ResultPanelProps) {
  // "Check answer" is disabled once the result shows, so focus moves to the next action.
  // The live region still announces the result.
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    next.current?.focus();
  }, []);

  return (
    <section className={styles.result} data-correct={correct} aria-live="polite" aria-label="Result">
      <p className={styles.resultTitle}>{correct ? "Correct." : "Not quite."}</p>
      {correct && alternative ? (
        <p>You found a different {step.technique} from the one we had in mind. It works too.</p>
      ) : null}
      {!correct ? <p>The answer is painted on the board.</p> : null}
      <p>{step.explanation}</p>
      <div>
        <Button ref={next} variant="primary" onClick={onNext}>
          Next drill
        </Button>
      </div>
    </section>
  );
}
