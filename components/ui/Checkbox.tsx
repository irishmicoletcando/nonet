import { Glyph } from "./Icon";

/** Display-only square checkbox. The surrounding text carries the meaning. */
export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className="checkbox" data-checked={checked} aria-hidden="true">
      {checked ? <Glyph name="check" size={14} strokeWidth={3} /> : null}
    </span>
  );
}
