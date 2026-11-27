import { Board } from "./Board";

const EMPTY_VALUES: number[] = new Array(81).fill(0);
const NO_GIVENS: boolean[] = new Array(81).fill(false);

/** Empty, read-only board frame shown while a puzzle is being made. */
export function BoardSkeleton({ size, label = "Puzzle loading" }: { size?: number; label?: string }) {
  return <Board label={label} values={EMPTY_VALUES} givens={NO_GIVENS} size={size} />;
}
