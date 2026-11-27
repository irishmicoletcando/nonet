// Pure progress helpers. Each takes the store and a `today` date, so they are easy to reason about.

import { TECHNIQUE_ORDER, TECHNIQUE_WEIGHT, type Technique } from "./engine";
import type { NonetStore } from "./storage";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Consecutive played days ending today, or ending yesterday if today is not played yet. */
export function streak(store: NonetStore, today: Date): number {
  const played = new Set(store.playedDays);
  let d = played.has(dateKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (played.has(dateKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function streakText(n: number): string {
  return n === 0 ? "No streak yet" : `${n}-day streak`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WeekSquare {
  day: (typeof WEEKDAYS)[number];
  key: string;
  played: boolean;
  isToday: boolean;
}

/** Monday to Sunday of the current local week. */
export function weekSquares(store: NonetStore, today: Date): WeekSquare[] {
  const played = new Set(store.playedDays);
  const offset = (today.getDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -offset);
  const todayKey = dateKey(today);
  return WEEKDAYS.map((day, i) => {
    const key = dateKey(addDays(monday, i));
    return { day, key, played: played.has(key), isToday: key === todayKey };
  });
}

export function weekLabel(squares: WeekSquare[]): string {
  const days = squares.filter((s) => s.played).map((s) => s.day);
  return days.length ? `Played ${days.join(", ")} this week` : "No days played this week";
}

/** Seconds as m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export const EMPTY = "—"; // em dash for "no data yet"

export function puzzlesSolved(store: NonetStore): number {
  return store.solves.length;
}

export function bestHardTime(store: NonetStore): string {
  const times = store.solves.filter((s) => s.difficulty === "Hard").map((s) => s.seconds);
  return times.length ? formatTime(Math.min(...times)) : EMPTY;
}

export function drillAccuracy(store: NonetStore): string {
  let correct = 0;
  let attempted = 0;
  for (const t of TECHNIQUE_ORDER) {
    const r = store.drills[t];
    if (!r) continue;
    correct += r.correct;
    attempted += r.attempted;
  }
  return attempted ? `${Math.round((correct / attempted) * 100)}%` : EMPTY;
}

/** Lowest accuracy among techniques with at least one attempt; ties go to the harder technique. */
export function weakestTechnique(store: NonetStore): Technique | null {
  let best: { t: Technique; acc: number } | null = null;
  for (const t of TECHNIQUE_ORDER) {
    const r = store.drills[t];
    if (!r || r.attempted < 1) continue;
    const acc = r.correct / r.attempted;
    if (!best || acc < best.acc || (acc === best.acc && TECHNIQUE_WEIGHT[t] > TECHNIQUE_WEIGHT[best.t])) {
      best = { t, acc };
    }
  }
  return best ? best.t : null;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export const DRILLS_PER_DAY = 3;

export function checklist(store: NonetStore, today: Date): ChecklistItem[] {
  const key = dateKey(today);
  const drills = store.drillsByDay[key] ?? 0;
  return [
    { label: "Solve one puzzle", done: store.solves.some((s) => s.date === key) },
    { label: "Review the daily puzzle", done: store.reviewedDaily.includes(key) },
    {
      label: `Do ${DRILLS_PER_DAY} technique drills (${Math.min(drills, DRILLS_PER_DAY)} of ${DRILLS_PER_DAY})`,
      done: drills >= DRILLS_PER_DAY,
    },
  ];
}
