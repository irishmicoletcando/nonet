"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/Board";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { Button } from "@/components/ui/Button";
import { DRILLS_PER_SESSION, TRAINER_TECHNIQUES } from "@/lib/constants";
import { checkAnswer, sameCells, type Drill } from "@/lib/drills";
import { TECHNIQUE_HELP, type Step, type Technique } from "@/lib/engine";
import { dateKey } from "@/lib/progress";
import { update, useNonetStore } from "@/lib/storage";
import { STALE, useEngine } from "@/lib/worker/useEngine";
import { ResultPanel } from "./ResultPanel";
import { TechniqueRow } from "./TechniqueRow";
import styles from "./Train.module.css";

const isTechnique = (t: string | null): t is Technique => t !== null && TRAINER_TECHNIQUES.includes(t as Technique);
const randomSeed = () => Math.floor(Math.random() * 2 ** 30) + 1;
const SINGLES: Technique[] = ["Naked Single", "Hidden Single"];

/** Reads `?t=` to preselect a technique; remounts when it changes. */
export function TrainScreen() {
  const t = useSearchParams().get("t");
  const initial = isTechnique(t) ? t : TRAINER_TECHNIQUES[0];
  return <Trainer key={initial} initial={initial} />;
}

interface Result {
  correct: boolean;
  step: Step;
  alternative: boolean;
}

type Status = "loading" | "ready" | "missing" | "error";

function Trainer({ initial }: { initial: Technique }) {
  const store = useNonetStore();
  const engine = useEngine();
  const [technique, setTechnique] = useState<Technique>(initial);
  const [n, setN] = useState(1);
  const [status, setStatus] = useState<Status>("loading");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const checked = useRef(false);
  const task = useRef<HTMLHeadingElement>(null);

  const loadDrill = useCallback(
    async (t: Technique) => {
      setStatus("loading");
      setDrill(null);
      setPicked([]);
      setResult(null);
      checked.current = false;
      try {
        const d = await engine.request({ type: "drill", technique: t, seed: randomSeed() });
        if (d === STALE) return;
        if (!d) {
          setStatus("missing");
          return;
        }
        setDrill(d);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [engine],
  );

  useEffect(() => {
    void loadDrill(technique);
    return () => engine.cancel();
  }, [technique, loadDrill, engine]);

  const pick = (t: Technique) => {
    if (t === technique) return;
    // Clear the old drill in the same render, so it never shows under the new heading.
    engine.cancel();
    setStatus("loading");
    setDrill(null);
    setPicked([]);
    setResult(null);
    setN(1);
    setTechnique(t);
  };

  const toggle = (cell: number) => {
    if (!drill || result || drill.grid[cell]) return;
    setPicked((p) => (p.includes(cell) ? p.filter((x) => x !== cell) : [...p, cell]));
  };

  const check = () => {
    if (!drill || result || picked.length === 0 || checked.current) return;
    checked.current = true;
    const isEngine = sameCells(picked, drill.step.highlight);
    const mine = isEngine ? drill.step : checkAnswer(drill.technique, drill.grid, drill.cands, picked);
    const correct = mine !== null;
    setResult({ correct, step: mine ?? drill.step, alternative: correct && !isEngine });
    const t = drill.technique;
    update((s) => {
      const r = s.drills[t] ?? { correct: 0, attempted: 0 };
      const key = dateKey(new Date());
      return {
        ...s,
        drills: { ...s.drills, [t]: { correct: r.correct + (correct ? 1 : 0), attempted: r.attempted + 1 } },
        drillsByDay: { ...s.drillsByDay, [key]: (s.drillsByDay[key] ?? 0) + 1 },
      };
    });
  };

  const next = () => {
    // The result panel (and the focused button) goes away; land on the new task.
    task.current?.focus();
    setN((x) => (x >= DRILLS_PER_SESSION ? 1 : x + 1));
    void loadDrill(technique);
  };

  const givens = useMemo(() => (drill ? drill.grid.map((v) => v !== 0) : []), [drill]);
  const progress = result ? n : n - 1;
  const single = SINGLES.includes(technique);

  return (
    <div className={styles.screen}>
      <div className="page-head">
        <h1>Technique trainer</h1>
      </div>

      <TechniqueRow selected={technique} drills={store.drills} onPick={pick} />

      <div className={styles.layout}>
        <div className={styles.boardCol}>
          {status === "ready" && drill ? (
            <Board
              label={`Find the ${technique}`}
              values={drill.grid}
              givens={givens}
              notes={drill.cands}
              pattern={result ? result.step.highlight : picked}
              eliminations={result ? result.step.eliminations : undefined}
              ghosts={result ? result.step.placements : undefined}
              selectionFollowsFocus={false}
              onSelect={toggle}
            />
          ) : (
            <BoardSkeleton />
          )}
        </div>

        <div className={styles.side}>
          <p className={styles.drillCount}>
            Drill {n} of {DRILLS_PER_SESSION}
          </p>
          <div className={styles.task}>
            <h2 ref={task} tabIndex={-1}>
              Find the {technique}
            </h2>
            <p>{TECHNIQUE_HELP[technique]}</p>
            <p className="muted">
              {single ? "Tap the cell, then check." : "Tap the cells that form the pattern, then check."}
            </p>
          </div>

          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={DRILLS_PER_SESSION}
            aria-valuenow={progress}
            aria-valuetext={`${progress} of ${DRILLS_PER_SESSION} drills done`}
          >
            <span style={{ width: `${(progress / DRILLS_PER_SESSION) * 100}%` }} />
          </div>

          {status === "loading" ? (
            <p className={styles.making} role="status">
              Making your puzzle…
            </p>
          ) : null}

          {status === "missing" || status === "error" ? (
            <div className={styles.missing} role="alert">
              <p>
                {status === "missing"
                  ? `Could not find a ${technique} position. Try again.`
                  : "Something went wrong making this drill. Try again."}
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  task.current?.focus();
                  void loadDrill(technique);
                }}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {status === "ready" ? (
            <div className={styles.actions}>
              <Button disabled={picked.length === 0 || result !== null} onClick={() => setPicked([])}>
                Clear
              </Button>
              <Button variant="primary" disabled={picked.length === 0 || result !== null} onClick={check}>
                Check answer
              </Button>
            </div>
          ) : null}

          {result ? (
            <ResultPanel
              correct={result.correct}
              step={result.step}
              alternative={result.alternative}
              onNext={next}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
