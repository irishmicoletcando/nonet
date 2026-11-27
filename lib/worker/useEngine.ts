"use client";

// Promise-based access to the engine worker.
// One worker is created lazily and shared by every screen. If a Worker cannot be
// created (or fails to load), the same task runs on the main thread inside
// setTimeout after the next paint, so the "Making your puzzle…" state still shows.

import { useRef } from "react";
import type { EngineRequest, EngineResult, WorkerResponse } from "./tasks";

interface Pending {
  req: EngineRequest;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

// Tasks are deterministic, so identical requests share one result.
const CACHE_MAX = 24;
const cache = new Map<string, Promise<unknown>>();

function runOnMainThread(p: Pending) {
  const go = () => {
    setTimeout(() => {
      import("./tasks")
        .then((m) => p.resolve(m.runTask(p.req)))
        .catch(p.reject);
    }, 0);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(go);
  else go();
}

function failOver() {
  workerBroken = true;
  worker?.terminate();
  worker = null;
  const all = [...pending.values()];
  pending.clear();
  all.forEach(runOnMainThread);
}

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
    // Fires when the worker script cannot load or throws outside a task.
    w.onerror = (e) => {
      e.preventDefault();
      failOver();
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

function send(req: EngineRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const p: Pending = { req, resolve, reject };
    const w = getWorker();
    if (!w) {
      runOnMainThread(p);
      return;
    }
    const id = nextId++;
    pending.set(id, p);
    try {
      w.postMessage({ id, req });
    } catch {
      pending.delete(id);
      runOnMainThread(p);
    }
  });
}

/** Run an engine task off the main thread. Results for identical requests are cached. */
export function runEngine<R extends EngineRequest>(req: R): Promise<EngineResult<R>> {
  const key = JSON.stringify(req);
  let promise = cache.get(key);
  if (!promise) {
    promise = send(req);
    cache.set(key, promise);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    promise.catch(() => cache.delete(key));
  } else {
    // Refresh recency.
    cache.delete(key);
    cache.set(key, promise);
  }
  return promise as Promise<EngineResult<R>>;
}

/** Marker returned by `useEngine().request` when a result arrived after a newer request. */
export const STALE: unique symbol = Symbol("stale");

/**
 * Hook for screens: `request(task)` resolves only if no newer request was made since
 * (call `cancel()` in effect cleanups and on unmount), so stale results are never applied.
 * `cancel()` invalidates anything in flight.
 */
export function useEngine() {
  const token = useRef(0);
  const api = useRef<{
    request: <R extends EngineRequest>(req: R) => Promise<EngineResult<R> | typeof STALE>;
    cancel: () => void;
  } | null>(null);
  if (api.current === null) {
    api.current = {
      request: async (req) => {
        const mine = ++token.current;
        try {
          const result = await runEngine(req);
          return mine === token.current ? result : STALE;
        } catch (err) {
          if (mine !== token.current) return STALE;
          throw err;
        }
      },
      cancel: () => {
        token.current++;
      },
    };
  }
  return api.current;
}

