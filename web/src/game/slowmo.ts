import { CONFIG } from './config';
import type { SimEvent, SlowMo } from './types';

export function createSlowMo(): SlowMo {
  return { active: false, meter: CONFIG.slowmo.capacity };
}

export function setSlowMo(s: SlowMo, on: boolean, events: SimEvent[]): void {
  if (s.active === on) return;
  s.active = on;
  events.push({ type: 'slowmo', on });
}

/** Switching off always works; switching on needs permission and a little meter. */
export function toggleSlowMo(s: SlowMo, allowed: boolean, events: SimEvent[]): void {
  if (s.active) setSlowMo(s, false, events);
  else if (allowed && s.meter >= CONFIG.slowmo.minStart) setSlowMo(s, true, events);
}

/** Runs on real time: drains while on (switching off when empty), refills while off. */
export function updateSlowMo(s: SlowMo, realDt: number, events: SimEvent[]): void {
  const c = CONFIG.slowmo;
  if (s.active) {
    s.meter = Math.max(0, s.meter - realDt);
    if (s.meter === 0) setSlowMo(s, false, events);
  } else {
    s.meter = Math.min(c.capacity, s.meter + c.refill * realDt);
  }
}

export function timeScale(s: SlowMo): number {
  return s.active ? CONFIG.slowmo.scale : 1;
}
