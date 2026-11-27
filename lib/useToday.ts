"use client";

import { useSyncExternalStore } from "react";
import { dateKey } from "./progress";

// Today's local date as YYYY-MM-DD, re-checked every 30 s and whenever the tab comes back,
// so anything keyed on "today" rolls over at midnight. Null during server render and hydration.

function subscribe(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  const onWake = () => cb();
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  };
}

const getKey = () => dateKey(new Date());
const getServerKey = () => null;

export function useTodayKey(): string | null {
  return useSyncExternalStore(subscribe, getKey, getServerKey);
}

/** Local midnight of a YYYY-MM-DD key. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
