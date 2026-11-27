"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Board } from "@/components/board/Board";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { Button, ButtonLink } from "@/components/ui/Button";
import { dailySeed, parseGrid, type Analysis } from "@/lib/engine";
import { positionBefore } from "@/lib/drills";
import { dateKey } from "@/lib/progress";
import { update } from "@/lib/storage";
import { EngineAborted, EngineTimeout, reviewIsolated } from "@/lib/worker/isolated";
import { runEngine } from "@/lib/worker/useEngine";
import { StepList } from "./StepList";
import { TechniqueChart } from "./TechniqueChart";
import styles from "./Review.module.css";

/** A normal review takes well under a second; past this the check is abandoned. */
const REVIEW_TIMEOUT_MS = 6000;

/** Same normalisation as parseGrid, so the count matches what it saw. */
const countCells = (s: string) => s.replace(/[.\-_*]/g, "0").replace(/[^0-9]/g, "").length;

/** If this is today's daily puzzle, tick "review the daily" for today. */
async function markIfDaily(grid: number[]) {
  const today = new Date();
  try {
    const daily = await runEngine({ type: "generate", difficulty: "Hard", seed: dailySeed(today) });
    if (daily.puzzle.join("") !== grid.join("")) return;
    const key = dateKey(today);
    update((s) => (s.reviewedDaily.includes(key) ? s : { ...s, reviewedDaily: [...s.reviewedDaily, key] }));
  } catch {
    // Not worth surfacing: the checklist just stays unticked.
  }
}

/** Reads `?p=` and remounts when it changes, so a new link always starts fresh. */
export function ReviewScreen() {
  const p = useSearchParams().get("p") ?? "";
  return <Review key={p} initial={p} />;
}

interface Result {
  puzzle: number[];
  analysis: Analysis;
}

function Review({ initial }: { initial: string }) {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [k, setK] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  // The in-flight check. Aborting terminates its dedicated worker.
  const inflight = useRef<AbortController | null>(null);

  const run = useCallback(async (input: string) => {
    inflight.current?.abort();
    inflight.current = null;
    const grid = parseGrid(input);
    if (!grid) {
      setBusy(false);
      setResult(null);
      setError(`That is not 81 cells. Found ${countCells(input)} digits.`);
      return;
    }
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await reviewIsolated(grid, { timeoutMs: REVIEW_TIMEOUT_MS, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setBusy(false);
      if (r.solutions !== 1 || !r.analysis) {
        setError("This puzzle has no unique solution.");
        return;
      }
      setResult({ puzzle: grid, analysis: r.analysis });
      setK(0);
      setSelected(null);
      void markIfDaily(grid);
    } catch (err) {
      if (err instanceof EngineAborted || ctrl.signal.aborted) return;
      setBusy(false);
      setError(
        err instanceof EngineTimeout
          ? "This puzzle took too long to check, so the review stopped. It may have very few clues or many solutions. Check the digits and try again."
          : "Could not review this puzzle. Try again.",
      );
    } finally {
      if (inflight.current === ctrl) inflight.current = null;
    }
  }, []);

  // Auto-run a puzzle passed in the link. Unmounting stops any check in flight.
  useEffect(() => {
    if (initial) void run(initial);
    return () => {
      inflight.current?.abort();
      inflight.current = null;
    };
  }, [initial, run]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(text);
  };

  const steps = result?.analysis.steps ?? [];
  const step = steps[k] ?? null;
  const view = useMemo(() => (result ? positionBefore(result.puzzle, result.analysis.steps, k) : null), [result, k]);
  const givens = useMemo(() => (result ? result.puzzle.map((v) => v !== 0) : []), [result]);
  const last = Math.max(0, steps.length - 1);
  const a = result?.analysis;

  return (
    <div className={styles.screen}>
      <div className="page-head">
        <h1>Puzzle review</h1>
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <label htmlFor={inputId} className={styles.label}>
          Paste an 81-character puzzle (0 or . for empty)
        </label>
        <textarea
          id={inputId}
          className={styles.input}
          rows={3}
          value={text}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setText(e.target.value)}
        />
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary">
            Review
          </Button>
        </div>
      </form>

      {busy && !result ? (
        <div className={styles.layout}>
          <div className={styles.boardCol}>
            <BoardSkeleton size={500} />
          </div>
          <p className={styles.making} role="status">
            Working through the puzzle…
          </p>
        </div>
      ) : null}

      {result && a && view ? (
        <div className={styles.layout}>
          <div className={styles.boardCol}>
            <Board
              label="Puzzle review board"
              size={500}
              values={view.grid}
              givens={givens}
              notes={view.cands}
              selected={selected}
              pattern={step?.highlight}
              eliminations={step?.eliminations}
              ghosts={step?.placements}
              onSelect={setSelected}
            />
            {steps.length ? (
              <>
                <div className={styles.stepNav}>
                  <Button small disabled={k === 0} onClick={() => setK((x) => Math.max(0, x - 1))}>
                    Back
                  </Button>
                  <span className={styles.stepCount}>
                    Step {k + 1} of {steps.length}
                  </span>
                  <Button small variant="primary" disabled={k >= last} onClick={() => setK((x) => Math.min(last, x + 1))}>
                    Next step
                  </Button>
                </div>
                {step ? (
                  <div className={styles.explain} aria-live="polite">
                    <p>
                      <strong>
                        Step {k + 1}: {step.technique}
                      </strong>
                    </p>
                    <p>{step.explanation}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">The solver found no logical step from the start.</p>
            )}
          </div>

          <div className={styles.side}>
            <div>
              <dl className={styles.summary}>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{a.solved ? a.difficulty : "Fiendish"}</dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd>{a.rating}</dd>
                </div>
                <div>
                  <dt>Hardest technique</dt>
                  <dd className={styles.summaryText}>{a.hardest ?? "—"}</dd>
                </div>
              </dl>
              {!a.solved ? (
                <p className={`muted ${styles.stuck}`}>The solver got stuck after {steps.length} steps.</p>
              ) : null}
            </div>

            {steps.length ? <TechniqueChart techniques={a.techniques} hardest={a.hardest} /> : null}

            {a.hardest ? (
              <div>
                <ButtonLink variant="secondary" href={`/train?t=${encodeURIComponent(a.hardest)}`}>
                  Drill {a.hardest}
                </ButtonLink>
              </div>
            ) : null}

            {steps.length ? <StepList steps={steps} current={k} onPick={setK} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
