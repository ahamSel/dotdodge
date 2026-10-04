// Dev-only recorded runs (see tools/capture): one character per sim step, so a run replays exactly.
import type { StepInput } from '../game/types';

export interface Replay {
  /** Per step: '.' for no input, or 'a'..'p' for one of 16 world-space directions (a = +x, counter-clockwise). */
  dirs: string;
  /** The step on which slow-mo is toggled on, or -1. */
  slowmo: number;
}

export const REPLAY_DIRS = 16;

export function encodeDir(dir: number): string {
  return dir < 0 ? '.' : String.fromCharCode(97 + dir);
}

export function replayInput(r: Replay, step: number): StepInput {
  const c = r.dirs.charCodeAt(step) - 97;
  const slowmo = step === r.slowmo;
  if (!(c >= 0 && c < REPLAY_DIRS)) return { move: { x: 0, y: 0 }, slowmo };
  const a = (c / REPLAY_DIRS) * Math.PI * 2;
  return { move: { x: Math.cos(a), y: Math.sin(a) }, slowmo };
}
