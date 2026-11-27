import { TRAINER_TECHNIQUES } from "@/lib/constants";
import type { Technique } from "@/lib/engine";
import type { NonetStore } from "@/lib/storage";
import styles from "./Train.module.css";

interface TechniqueRowProps {
  selected: Technique;
  drills: NonetStore["drills"];
  onPick: (t: Technique) => void;
}

export function TechniqueRow({ selected, drills, onPick }: TechniqueRowProps) {
  return (
    <div className={styles.techScroll}>
      <div className={styles.techRow} role="group" aria-label="Technique">
        {TRAINER_TECHNIQUES.map((t) => {
          const r = drills[t] ?? { correct: 0, attempted: 0 };
          return (
            <button
              key={t}
              type="button"
              className={styles.techButton}
              aria-pressed={t === selected}
              aria-label={`${t}, ${r.correct} of ${r.attempted} correct`}
              onClick={() => onPick(t)}
            >
              <span className={styles.techName}>{t}</span>
              <span className={styles.techScore}>
                {r.correct}/{r.attempted}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
