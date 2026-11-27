// Engine tasks shared by the Web Worker and the main-thread fallback.
// Every task is a pure function of its request, so results can be cached by request.

import {
  analyze,
  countSolutions,
  generatePuzzle,
  type Analysis,
  type Difficulty,
  type Puzzle,
  type Technique,
} from "../engine";
import { buildDrill, type Drill } from "../drills";

export type EngineRequest =
  | { type: "generate"; difficulty: Difficulty; seed: number }
  | { type: "analyze"; grid: number[] }
  | { type: "review"; grid: number[] }
  | { type: "drill"; technique: Technique; seed: number };

export interface ReviewResult {
  /** 0, 1 or 2 (2 = more than one). */
  solutions: number;
  /** Present only when the puzzle has exactly one solution. */
  analysis: Analysis | null;
}

export interface EngineResultMap {
  generate: Puzzle;
  analyze: Analysis;
  review: ReviewResult;
  drill: Drill | null;
}

export type EngineResult<R extends EngineRequest> = EngineResultMap[R["type"]];

export function runTask(req: EngineRequest): EngineResultMap[EngineRequest["type"]] {
  switch (req.type) {
    case "generate":
      return generatePuzzle(req.difficulty, req.seed);
    case "analyze":
      return analyze(req.grid);
    case "review": {
      const solutions = countSolutions(req.grid, 2);
      return { solutions, analysis: solutions === 1 ? analyze(req.grid) : null };
    }
    case "drill":
      return buildDrill(req.technique, req.seed);
  }
}

export interface WorkerRequest {
  id: number;
  req: EngineRequest;
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
