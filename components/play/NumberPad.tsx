import styles from "./Play.module.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface NumberPadProps {
  /** remaining[d] for d = 1..9. */
  remaining: number[];
  notesMode: boolean;
  disabled: boolean;
  onDigit: (d: number) => void;
}

export function NumberPad({ remaining, notesMode, disabled, onDigit }: NumberPadProps) {
  return (
    <div className={styles.pad} role="group" aria-label={notesMode ? "Number pad, notes mode" : "Number pad"}>
      {DIGITS.map((d) => {
        const left = remaining[d] ?? 0;
        return (
          <button
            key={d}
            type="button"
            className={styles.padKey}
            disabled={disabled || left === 0}
            aria-label={`${notesMode ? "Note" : "Enter"} ${d}, ${left} left`}
            onClick={() => onDigit(d)}
          >
            <span className={styles.padDigit} aria-hidden="true">
              {d}
            </span>
            <span className={styles.padCount} aria-hidden="true">
              {left}
            </span>
          </button>
        );
      })}
    </div>
  );
}
