// Web Worker entry: runs engine tasks off the main thread.

import { runTask, type WorkerRequest, type WorkerResponse } from "./tasks";

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerResponse): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, req } = e.data;
  try {
    scope.postMessage({ id, ok: true, result: runTask(req) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
