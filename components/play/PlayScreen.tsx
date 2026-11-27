"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Board } from "@/components/board/Board";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { MISTAKES_ALLOWED } from "@/lib/constants";
import { DIFFICULTIES, dailySeed, type Analysis, type Difficulty } from "@/lib/engine";
import {
  computeHint,
  formatClock,
  gameReducer,
  initState,
  newGame,
  remainingCounts,
  sameGame,
  supersedes,
  wrongCells,
  type GameAction,
  type GameState,
  type Hint,
} from "@/lib/game";
import { dateKey } from "@/lib/progress";
import { load, update, useNonetStore, type SavedGame } from "@/lib/storage";
import { STALE, useEngine } from "@/lib/worker/useEngine";
import { HintPanel } from "./HintPanel";
import { NumberPad } from "./NumberPad";
import { ToolRow } from "./ToolRow";
import { LostPanel, WinPanel } from "./WinPanel";
import styles from "./Play.module.css";

type Action = GameAction | { type: "load"; game: SavedGame };

function reducer(state: GameState | null, action: Action): GameState | null {
  if (action.type === "load") return initState(action.game);
  return state ? gameReducer(state, action) : state;
}

const DEFAULT_DIFFICULTY: Difficulty = "Medium";

/** Reads `?daily` and remounts the game when the mode changes, so nothing carries over. */
export function PlayScreen() {
  const params = useSearchParams();
  const daily = params.get("daily") === "1";
  return <PlayGame key={daily ? "daily" : "quick"} daily={daily} />;
}

function PlayGame({ daily }: { daily: boolean }) {
  const mode = daily ? "daily" : "quick";
  const engine = useEngine();
  const winEngine = useEngine();

  const [state, dispatch] = useReducer(reducer, null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [hint, setHint] = useState<{ hint: Hint; stage: 1 | 2 } | null>(null);
  const [techniques, setTechniques] = useState<Analysis["techniques"] | null>(null);

  const game = state?.game ?? null;

  const start = useCallback(
    async (difficulty: Difficulty) => {
      setLoading(true);
      setFailed(false);
      setHint(null);
      setSelected(null);
      const today = new Date();
      try {
        const p = await engine.request(
          daily
            ? { type: "generate", difficulty: "Hard", seed: dailySeed(today) }
            : { type: "generate", difficulty, seed: Date.now() % 2 ** 31 },
        );
        if (p === STALE) return;
        dispatch({ type: "load", game: newGame(p, daily, dateKey(today)) });
        setLoading(false);
      } catch {
        setFailed(true);
        setLoading(false);
      }
    },
    [daily, engine],
  );

  // Resume a saved game for this mode, else make a new one.
  useEffect(() => {
    const saved = load().games[mode];
    const today = dateKey(new Date());
    if (saved && saved.daily === daily) {
      // Daily: keep today's game whatever its state. Quick: resume only an unfinished game.
      const resume = daily ? saved.dateKey === today : saved.status === "playing";
      if (resume) {
        engine.cancel();
        dispatch({ type: "load", game: saved });
        if (DIFFICULTIES.includes(saved.difficulty)) setRequested(saved.difficulty);
        setLoading(false);
        return;
      }
      if (!daily && DIFFICULTIES.includes(saved.difficulty)) {
        setRequested(saved.difficulty);
        void start(saved.difficulty);
        return () => engine.cancel();
      }
    }
    void start(DEFAULT_DIFFICULTY);
    return () => engine.cancel();
    // Mount only: the component is keyed by mode, so a mode change remounts it.
  }, []);

  // Persist after every change. `update` starts from the freshly stored value, so this also
  // arbitrates between tabs: if the stored copy of this game is further along (won in another
  // tab, or restarted there), keep it and adopt it instead of writing ours over it.
  // Recording the solve is idempotent: only when the stored copy of this game was not already won.
  useEffect(() => {
    if (!game) return;
    const adopt: { game: SavedGame | null } = { game: null };
    update((s) => {
      const prev = s.games[mode];
      if (prev && supersedes(prev, game)) {
        adopt.game = prev;
        return s;
      }
      const alreadyWon = prev !== undefined && prev.status === "won" && sameGame(prev, game);
      const next = { ...s, games: { ...s.games, [mode]: game } };
      if (game.status === "won" && !alreadyWon) {
        const today = dateKey(new Date());
        next.solves = [
          ...s.solves,
          { date: today, difficulty: game.difficulty, seconds: game.seconds, mistakes: game.mistakes, daily: game.daily },
        ];
        next.playedDays = [...s.playedDays, today];
      }
      return next;
    });
    if (adopt.game) dispatch({ type: "load", game: adopt.game });
  }, [game, mode]);

  // Follow other tabs: when the stored copy of this game moves ahead, show it.
  const stored = useNonetStore().games[mode];
  useEffect(() => {
    if (loading || !game || !stored) return;
    if (supersedes(stored, game)) {
      setHint(null);
      dispatch({ type: "load", game: stored });
    }
  }, [stored, game, loading]);

  // Timer: ticks while playing and the tab is visible.
  const playing = !loading && game?.status === "playing";
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") dispatch({ type: "tick" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Techniques for the win panel.
  const won = !loading && game?.status === "won";
  const puzzleKey = game ? game.puzzle.join("") : "";
  useEffect(() => {
    if (!won) return;
    setTechniques(null);
    winEngine
      .request({ type: "analyze", grid: puzzleKey.split("").map(Number) })
      .then((a) => {
        if (a !== STALE) setTechniques(a.techniques);
      })
      .catch(() => setTechniques({}));
    return () => winEngine.cancel();
  }, [won, puzzleKey, winEngine]);

  const wrong = useMemo(() => (game ? wrongCells(game) : []), [game]);
  const remaining = useMemo(() => remainingCounts(game ? game.values : []), [game]);
  const givens = useMemo(() => (game ? game.puzzle.map((v) => v !== 0) : []), [game]);

  function act(a: GameAction) {
    setHint(null);
    dispatch(a);
  }
  const input = (digit: number) => {
    if (selected !== null) act({ type: "input", cell: selected, digit, notesMode });
  };
  const erase = () => {
    if (selected !== null) act({ type: "erase", cell: selected });
  };
  const toggleNotes = () => setNotesMode((m) => !m);
  const openHint = () => {
    if (!game || hint) return;
    setHint({ hint: computeHint(game), stage: 1 });
    dispatch({ type: "hint" });
  };
  const newQuick = () => void start(requested);
  const pickDifficulty = (d: Difficulty) => {
    setRequested(d);
    void start(d);
  };

  const title = daily ? "Daily puzzle" : "Quick game";
  const ready = !loading && game !== null;
  const pattern = hint && hint.stage === 2 && hint.hint.kind === "step" ? hint.hint.step.highlight : undefined;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <h1>{title}</h1>
        {!daily ? (
          <div className={styles.picker} role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={styles.pickerButton}
                aria-pressed={requested === d}
                onClick={() => pickDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {ready && game ? (
        <div className={styles.status}>
          <Pill tone="yellow">{game.difficulty.toUpperCase()}</Pill>
          <span>
            Mistakes {game.mistakes}/{MISTAKES_ALLOWED}
          </span>
          <span className={styles.clock} aria-label={`Time ${formatClock(game.seconds)}`}>
            {formatClock(game.seconds)}
          </span>
          {!daily ? (
            <span className={styles.statusEnd}>
              <Button small onClick={newQuick}>
                <Glyph name="play" size={16} />
                New game
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.boardCol}>
          {ready && game ? (
            <Board
              label={`${title} board`}
              values={game.values}
              givens={givens}
              notes={game.notes}
              selected={selected}
              wrong={wrong}
              pattern={pattern}
              onSelect={setSelected}
              onInput={playing ? input : undefined}
              onErase={playing ? erase : undefined}
              onToggleNotes={playing ? toggleNotes : undefined}
            />
          ) : (
            <BoardSkeleton />
          )}
        </div>

        <div className={styles.side}>
          {failed ? (
            <div className={styles.endPanel} role="alert">
              <p>Could not make a puzzle.</p>
              <Button variant="primary" onClick={() => void start(requested)}>
                Try again
              </Button>
            </div>
          ) : !ready || !game ? (
            <p className={styles.making} role="status">
              Making your puzzle…
            </p>
          ) : (
            <>
              {game.status === "won" ? (
                <WinPanel game={game} techniques={techniques} onNewGame={daily ? undefined : newQuick} />
              ) : null}
              {game.status === "lost" ? (
                <LostPanel
                  game={game}
                  onRetry={() => {
                    if (daily) act({ type: "restart" });
                    else newQuick();
                  }}
                />
              ) : null}
              {game.status === "playing" ? (
                <>
                  <ToolRow
                    disabled={false}
                    canUndo={(state?.history.length ?? 0) > 0}
                    notesMode={notesMode}
                    onUndo={() => act({ type: "undo" })}
                    onErase={erase}
                    onToggleNotes={toggleNotes}
                    onHint={openHint}
                  />
                  <NumberPad remaining={remaining} notesMode={notesMode} disabled={false} onDigit={input} />
                  {selected === null ? (
                    <p className="muted">Pick a cell, then a number.</p>
                  ) : null}
                  {hint ? (
                    <HintPanel
                      hint={hint.hint}
                      stage={hint.stage}
                      onShow={() => setHint({ ...hint, stage: 2 })}
                      onClose={() => setHint(null)}
                    />
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
