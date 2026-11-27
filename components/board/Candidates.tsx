import styles from "./Board.module.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Pencil marks as a 3x3 monospace grid: digit d sits at position d-1.
 * `mask` and `struck` use the engine's Cands format (bit d = digit d).
 */
export function Candidates({ mask, struck = 0 }: { mask: number; struck?: number }) {
  const shown = mask | struck;
  return (
    <span className={styles.cands} aria-hidden="true">
      {DIGITS.map((d) => {
        const bit = 1 << d;
        const on = (shown & bit) !== 0;
        const isStruck = (struck & bit) !== 0;
        return (
          <span key={d} className={isStruck ? `${styles.cand} ${styles.struck}` : styles.cand}>
            {on ? d : ""}
          </span>
        );
      })}
    </span>
  );
}
