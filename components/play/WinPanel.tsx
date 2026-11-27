import { Button, ButtonLink } from "@/components/ui/Button";
import { MISTAKES_ALLOWED } from "@/lib/constants";
import { TECHNIQUE_ORDER, type Analysis } from "@/lib/engine";
import { formatTime } from "@/lib/progress";
import type { SavedGame } from "@/lib/storage";
import styles from "./Play.module.css";

const reviewHref = (g: SavedGame) => `/review?p=${g.puzzle.join("")}`;

interface WinPanelProps {
  game: SavedGame;
  techniques: Analysis["techniques"] | null;
  onNewGame?: () => void;
}

export function WinPanel({ game, techniques, onNewGame }: WinPanelProps) {
  const used = techniques ? TECHNIQUE_ORDER.filter((t) => techniques[t]) : [];
  return (
    <section className={styles.endPanel} aria-labelledby="win-title" aria-live="polite">
      <h2 id="win-title">Solved.</h2>
      <dl className={styles.endStats}>
        <div>
          <dt>Time</dt>
          <dd>{formatTime(game.seconds)}</dd>
        </div>
        <div>
          <dt>Mistakes</dt>
          <dd>
            {game.mistakes} of {MISTAKES_ALLOWED}
          </dd>
        </div>
      </dl>
      <div>
        <h3 className={styles.endSub}>Techniques used</h3>
        {techniques === null ? (
          <p className="muted">Working them out…</p>
        ) : (
          <table className={styles.techTable}>
            <tbody>
              {used.map((t) => (
                <tr key={t}>
                  <th scope="row">{t}</th>
                  <td>{techniques[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={styles.endActions}>
        <ButtonLink variant="primary" href={reviewHref(game)}>
          Review this puzzle
        </ButtonLink>
        {onNewGame ? <Button onClick={onNewGame}>New game</Button> : null}
      </div>
    </section>
  );
}

interface LostPanelProps {
  game: SavedGame;
  onRetry: () => void;
}

export function LostPanel({ game, onRetry }: LostPanelProps) {
  return (
    <section className={styles.endPanel} aria-labelledby="lost-title" aria-live="polite">
      <h2 id="lost-title">Out of mistakes</h2>
      <p className="muted">
        That was mistake {game.mistakes} of {MISTAKES_ALLOWED}. The board is locked.
      </p>
      <div className={styles.endActions}>
        <Button variant="primary" onClick={onRetry}>
          {game.daily ? "Try again" : "New game"}
        </Button>
        <ButtonLink href={reviewHref(game)}>Review this puzzle</ButtonLink>
      </div>
    </section>
  );
}
