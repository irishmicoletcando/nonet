"use client";

// One-off engine tasks in their own Worker, for work that can run unbounded (the
// uniqueness check on a pasted puzzle). The worker is terminated on timeout, on abort
// (a newer request or unmount), and after it answers, so it can never hold up the
// shared worker other screens use.

import { analyze } from "../engine";
import { countSolutionsBudget } from "../solutions";
import type { ReviewResult, WorkerResponse } from "./tasks";

/** Rejection reason when the task exceeded its time (or, without Workers, its work budget). */
export class EngineTimeout extends Error {
  constructor() {
    super("The engine took too long.");
    this.name = "EngineTimeout";
  }
}

/** Rejection reason when the caller aborted. */
export class EngineAborted extends Error {
  constructor() {
    super("Aborted.");
    this.name = "EngineAborted";
  }
}

/**
 * Main-thread fallback when Workers are unavailable. The uniqueness check gets a fixed
 * work budget (about 0.2 s on a laptop; every generated puzzle needs under 1% of it), so
 * it can never freeze the page; past the budget it reports a timeout instead.
 */
export const FALLBACK_NODE_BUDGET = 2_000_000;

function reviewOnMainThread(grid: number[], signal: AbortSignal): Promise<ReviewResult> {
  return new Promise((resolve, reject) => {
    const go = () =>
      setTimeout(() => {
        if (signal.aborted) return reject(new EngineAborted());
        const { count, complete } = countSolutionsBudget(grid, 2, FALLBACK_NODE_BUDGET);
        if (!complete) return reject(new EngineTimeout());
        resolve({ solutions: count, analysis: count === 1 ? analyze(grid) : null });
      }, 0);
    // Let the "working" state paint first.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(go);
    else go();
  });
}

/** Count solutions and analyze `grid` in a dedicated, killable worker. */
export function reviewIsolated(grid: number[], opts: { timeoutMs: number; signal: AbortSignal }): Promise<ReviewResult> {
  const { timeoutMs, signal } = opts;
  if (signal.aborted) return Promise.reject(new EngineAborted());

  let worker: Worker;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return reviewOnMainThread(grid, signal);
  }

  return new Promise<ReviewResult>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      worker.terminate();
      fn();
    };
    const onAbort = () => finish(() => reject(new EngineAborted()));
    const timer = setTimeout(() => finish(() => reject(new EngineTimeout())), timeoutMs);
    signal.addEventListener("abort", onAbort);

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      finish(() => (msg.ok ? resolve(msg.result as ReviewResult) : reject(new Error(msg.error))));
    };
    // The worker script failed to load: fall back to the budgeted main-thread check.
    worker.onerror = (e) => {
      e.preventDefault();
      finish(() => reviewOnMainThread(grid, signal).then(resolve, reject));
    };
    worker.postMessage({ id: 1, req: { type: "review", grid } });
  });
}
