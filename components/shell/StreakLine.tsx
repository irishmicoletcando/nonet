"use client";

import { useNonetStore } from "@/lib/storage";
import { streak, streakText, weekLabel, weekSquares } from "@/lib/progress";
import styles from "./Shell.module.css";

export function StreakLine() {
  const store = useNonetStore();
  const today = new Date();
  const n = streak(store, today);
  const squares = weekSquares(store, today);

  return (
    <div className={styles.streak}>
      <p className={styles.streakText}>{streakText(n)}</p>
      <div className={styles.week} role="img" aria-label={weekLabel(squares)}>
        {squares.map((s) => (
          <span
            key={s.day}
            className={styles.day}
            data-played={s.played}
            data-today={s.isToday}
            title={s.day}
          />
        ))}
      </div>
    </div>
  );
}
