"use client";

import { useNonetStore } from "@/lib/storage";
import { streak, streakText, weekLabel, weekSquares } from "@/lib/progress";
import { dateFromKey, useTodayKey } from "@/lib/useToday";
import styles from "./Shell.module.css";

/** Stand-in date for the server render, where the store is empty anyway. */
const SERVER_DAY = new Date(2000, 0, 3);

export function StreakLine() {
  const store = useNonetStore();
  // Re-renders when the date changes, so the streak and week roll over at midnight.
  const key = useTodayKey();
  const today = key ? dateFromKey(key) : SERVER_DAY;
  const n = key ? streak(store, today) : 0;
  const squares = weekSquares(store, today);

  return (
    <div className={styles.streak}>
      <p className={styles.streakText}>{streakText(n)}</p>
      <div className={styles.week} role="img" aria-label={weekLabel(squares)}>
        {squares.map((s) => (
          <span
            key={s.day}
            className={styles.day}
            data-played={key ? s.played : false}
            data-today={key ? s.isToday : false}
            title={s.day}
          />
        ))}
      </div>
    </div>
  );
}
