import { Glyph } from "@/components/ui/Icon";
import styles from "./Play.module.css";

interface ToolRowProps {
  disabled: boolean;
  canUndo: boolean;
  notesMode: boolean;
  onUndo: () => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint: () => void;
}

export function ToolRow({ disabled, canUndo, notesMode, onUndo, onErase, onToggleNotes, onHint }: ToolRowProps) {
  return (
    <div className={styles.tools} role="group" aria-label="Tools">
      <button type="button" className={styles.tool} disabled={disabled || !canUndo} onClick={onUndo}>
        <Glyph name="undo" size={22} />
        <span>Undo</span>
      </button>
      <button type="button" className={styles.tool} disabled={disabled} onClick={onErase}>
        <Glyph name="erase" size={22} />
        <span>Erase</span>
      </button>
      <button
        type="button"
        className={styles.tool}
        disabled={disabled}
        aria-pressed={notesMode}
        onClick={onToggleNotes}
      >
        <Glyph name="notes" size={22} />
        <span>Notes</span>
      </button>
      <button type="button" className={styles.tool} disabled={disabled} onClick={onHint}>
        <Glyph name="hint" size={22} />
        <span>Hint</span>
      </button>
    </div>
  );
}
