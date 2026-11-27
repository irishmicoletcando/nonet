"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Board } from "@/components/board/Board";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Glyph, Icon, type IconName, type Tint } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { USER_NAME } from "@/lib/constants";
import { dailySeed, type Difficulty, type Technique } from "@/lib/engine";
import {
  EMPTY,
  bestHardTime,
  checklist,
  dateKey,
  drillAccuracy,
  puzzlesSolved,
  streak,
  weakestTechnique,
} from "@/lib/progress";
import { useNonetStore } from "@/lib/storage";
import { STALE, useEngine } from "@/lib/worker/useEngine";
import styles from "./Home.module.css";

// ---------- clock (client only; null during server render and hydration) ----------
function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, noMinute);
  return useMemo(() => (minute === null ? null : new Date(minute * 60_000)), [minute]);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function greeting(d: Date | null) {
  const h = d ? d.getHours() : 9;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function needsLine(t: Technique | null) {
  if (!t) return "Today's puzzle is ready.";
  const name = t.toLowerCase();
  return `Today's puzzle needs ${/^[aeioux]/.test(name) ? "an" : "a"} ${name}.`;
}

// ---------- play list ----------
interface PlayRow {
  title: string;
  description: string;
  icon: IconName;
  tint: Tint;
  href?: string;
}

const PLAY_ROWS: PlayRow[] = [
  { title: "Quick game", description: "Classic 9x9 at the difficulty you choose. Notes and hints included.", icon: "play", tint: "mint", href: "/play" },
  { title: "Technique trainer", description: "Drill naked pairs, pointing pairs, X-wings and more on real positions.", icon: "train", tint: "pink", href: "/train" },
  { title: "Speed run", description: "Five puzzles back to back against the clock.", icon: "bolt", tint: "yellow" },
  { title: "Spot the mistake", description: "One digit is wrong. Find it.", icon: "search", tint: "lavender" },
];

interface Daily {
  key: string;
  puzzle: number[];
  difficulty: Difficulty;
  hardest: Technique | null;
}

export function HomeScreen() {
  const store = useNonetStore();
  const now = useNow();
  const engine = useEngine();
  const [daily, setDaily] = useState<Daily | null>(null);
  const [failed, setFailed] = useState(false);

  const todayKey = now ? dateKey(now) : null;

  useEffect(() => {
    if (!todayKey) return;
    const [y, m, d] = todayKey.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    (async () => {
      const p = await engine.request({ type: "generate", difficulty: "Hard", seed: dailySeed(day) });
      if (p === STALE) return;
      const a = await engine.request({ type: "analyze", grid: p.puzzle });
      if (a === STALE) return;
      setDaily({ key: todayKey, puzzle: p.puzzle, difficulty: p.difficulty, hardest: a.hardest });
    })().catch(() => setFailed(true));
    return () => engine.cancel();
  }, [todayKey, engine]);

  const givens = useMemo(() => (daily ? daily.puzzle.map((v) => v !== 0) : []), [daily]);
  const n = now ? streak(store, now) : 0;
  const items = now ? checklist(store, now) : checklist(store, new Date(0));
  const dateLine = now
    ? `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}. ${n > 0 ? `Day ${n} of your streak.` : "Start a streak today."}`
    : " ";
  const weakest = weakestTechnique(store);
  const ready = daily !== null && daily.key === todayKey;

  return (
    <div className={styles.screen}>
      <div className="page-head">
        <h1>
          {greeting(now)}, {USER_NAME}
        </h1>
        <p>{dateLine}</p>
      </div>

      <section className={styles.hero} aria-label="Today's puzzle">
        <div className={styles.heroBoard}>
          {ready ? (
            <Board label="Today's puzzle, preview" size={400} values={daily.puzzle} givens={givens} />
          ) : (
            <BoardSkeleton size={400} />
          )}
        </div>
        <div className={styles.heroText}>
          {ready ? (
            <>
              <div>
                <Pill tone="yellow">{daily.difficulty.toUpperCase()}</Pill>
              </div>
              <h2 className={styles.heroTitle}>{needsLine(daily.hardest)}</h2>
            </>
          ) : (
            <p className={styles.making} role="status">
              {failed ? "Could not make today's puzzle. Reload to try again." : "Making your puzzle…"}
            </p>
          )}
          <p className={styles.heroCopy}>
            Everyone gets the same grid. Solve it to keep your streak, then review it to see every technique it uses.
          </p>
          <div className={styles.heroActions}>
            <ButtonLink variant="primary" href="/play?daily=1">
              Play daily
            </ButtonLink>
            {ready ? (
              <ButtonLink href={`/review?p=${daily.puzzle.join("")}`}>Review first</ButtonLink>
            ) : (
              <span className="btn btn-secondary" aria-disabled="true">
                Review first
              </span>
            )}
          </div>
          <ul className={styles.checklist} aria-label="Today's checklist">
            {items.map((it) => (
              <li key={it.label}>
                <Checkbox checked={it.done} />
                <span>
                  {it.label}
                  <span className="visually-hidden">{it.done ? ", done" : ", not done"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-play">
        <h2 id="home-play">Play</h2>
        <ul className={`rule-list ${styles.playList}`}>
          {PLAY_ROWS.map((r) => {
            const body = (
              <>
                <Icon name={r.icon} tint={r.tint} />
                <span className={styles.playText}>
                  <span className={styles.playTitle}>
                    {r.title}
                    {r.href ? null : <Pill tone="muted">SOON</Pill>}
                  </span>
                  <span className={styles.playDesc}>{r.description}</span>
                </span>
                {r.href ? (
                  <span className={styles.playArrow}>
                    <Glyph name="arrow" size={20} />
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={r.title}>
                {r.href ? (
                  <Link href={r.href} className={styles.playRow}>
                    {body}
                  </Link>
                ) : (
                  <div className={styles.playRow} aria-disabled="true">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="home-numbers">
        <h2 id="home-numbers">Your numbers</h2>
        <dl className={`stat-row ${styles.stats}`}>
          <div>
            <dt>Puzzles solved</dt>
            <dd>{puzzlesSolved(store)}</dd>
          </div>
          <div>
            <dt>Best Hard time</dt>
            <dd>{bestHardTime(store)}</dd>
          </div>
          <div>
            <dt>Drill accuracy</dt>
            <dd>{drillAccuracy(store)}</dd>
          </div>
          <div>
            <dt>Weakest technique</dt>
            <dd className={styles.statText}>{weakest ?? EMPTY}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
