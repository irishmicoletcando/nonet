import { TECHNIQUE_ORDER, type Analysis, type Technique } from "@/lib/engine";
import styles from "./Review.module.css";

interface TechniqueChartProps {
  techniques: Analysis["techniques"];
  hardest: Technique | null;
}

/** Horizontal bars, one row per technique used, in engine order. Hardest bar in red. */
export function TechniqueChart({ techniques, hardest }: TechniqueChartProps) {
  const rows = TECHNIQUE_ORDER.filter((t) => techniques[t]).map((t) => ({ t, n: techniques[t] ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <table className={styles.chart}>
      <caption className={styles.sectionTitle}>Techniques used</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">Technique</th>
          <th scope="col">Share</th>
          <th scope="col">Steps</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ t, n }) => (
          <tr key={t}>
            <th scope="row">{t}</th>
            <td className={styles.barCell} aria-hidden="true">
              <span
                className={styles.bar}
                data-hardest={t === hardest}
                style={{ width: `${Math.max(4, (n / max) * 100)}%` }}
              />
            </td>
            <td className={styles.count}>{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
