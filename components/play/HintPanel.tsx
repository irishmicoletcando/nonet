"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Icon";
import type { Hint } from "@/lib/game";
import styles from "./Play.module.css";

interface HintPanelProps {
  hint: Hint;
  stage: 1 | 2;
  onShow: () => void;
  onClose: () => void;
}

export function HintPanel({ hint, stage, onShow, onClose }: HintPanelProps) {
  // "Show me where" disappears when stage 2 opens; move focus to what replaced it.
  const explanation = useRef<HTMLParagraphElement>(null);
  const shown = useRef(stage);
  useEffect(() => {
    if (shown.current === 1 && stage === 2) explanation.current?.focus();
    shown.current = stage;
  }, [stage]);

  return (
    <section className={styles.hint} aria-label="Hint" aria-live="polite">
      <button type="button" className={styles.hintClose} aria-label="Close hint" onClick={onClose}>
        <Glyph name="close" size={18} strokeWidth={2.4} />
      </button>
      {hint.kind === "wrong" ? (
        <p className={styles.hintText}>One or more digits are wrong. They are marked in red.</p>
      ) : hint.kind === "none" ? (
        <p className={styles.hintText}>No hint from this position. Check your digits against the rules.</p>
      ) : (
        <>
          <p className={styles.hintTitle}>
            <strong>Hint: {hint.step.technique}</strong>
            <span className="muted">Step {stage} of 2</span>
          </p>
          {stage === 1 ? (
            <>
              <p className={styles.hintText}>Look in {hint.region}.</p>
              <Button variant="primary" small onClick={onShow}>
                Show me where
              </Button>
            </>
          ) : (
            <p ref={explanation} tabIndex={-1} className={styles.hintText}>
              {hint.step.explanation}
            </p>
          )}
        </>
      )}
    </section>
  );
}
