import type { ReactNode } from "react";

export type PillTone = "muted" | "yellow" | "red";

export function Pill({ tone = "muted", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
