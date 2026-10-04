import { CONFIG } from './config';

/** The countdown starts when missile 0 launches, one warning after the run begins. */
export const INTRO = CONFIG.missile.warnTime;

export function elapsedAt(time: number): number {
  return Math.max(0, time - INTRO);
}

export function stageAt(elapsed: number): number {
  let stage = 1;
  for (const t of CONFIG.stages) if (elapsed >= t) stage++;
  return stage;
}

/** The number the countdown shows: rounded up, so the last second reads 1 and 0 means done. */
export function countdownShown(elapsed: number): number {
  return Math.max(0, Math.ceil(CONFIG.countdown - elapsed - 1e-9));
}

export function warnTimeOf(index: number): number {
  return INTRO + CONFIG.missiles[index].warnAt;
}

export function launchTimeOf(index: number): number {
  return warnTimeOf(index) + CONFIG.missile.warnTime;
}

/** True while a warning chevron is lit, `t` seconds into its warning. */
export function warningLit(t: number): boolean {
  return CONFIG.missile.blinks.some((b) => t >= b && t < b + CONFIG.missile.blinkLength);
}

/** Start of the latest blink at or before `t`, or -1 before the first. */
export function lastBlinkStart(t: number): number {
  let start = -1;
  for (const b of CONFIG.missile.blinks) if (t >= b) start = b;
  return start;
}

export function formatTime(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
