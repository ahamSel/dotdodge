import { describe, expect, it } from 'vitest';
import { createSlowMo, timeScale, toggleSlowMo, updateSlowMo } from '../src/game/slowmo';
import type { SimEvent } from '../src/game/types';

describe('slow-mo', () => {
  it('stays locked until it is allowed', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, false, events);
    expect(s.active).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('toggles on and off, slowing the world to 0.1×', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, true, events);
    expect(s.active).toBe(true);
    expect(timeScale(s)).toBe(0.1);
    toggleSlowMo(s, true, events);
    expect(timeScale(s)).toBe(1);
    expect(events).toEqual([
      { type: 'slowmo', on: true },
      { type: 'slowmo', on: false },
    ]);
  });

  it('drains in real seconds and switches itself off when empty', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, true, events);
    updateSlowMo(s, 2, events);
    expect(s.meter).toBeCloseTo(3);
    updateSlowMo(s, 3.5, events);
    expect(s.meter).toBe(0);
    expect(s.active).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'slowmo', on: false });
  });

  it('refills at half speed while off, up to 5 s', () => {
    const s = createSlowMo();
    s.meter = 0;
    updateSlowMo(s, 4, []);
    expect(s.meter).toBeCloseTo(2);
    updateSlowMo(s, 100, []);
    expect(s.meter).toBe(5);
  });

  it('needs a quarter second in the meter to start', () => {
    const s = createSlowMo();
    s.meter = 0.2;
    toggleSlowMo(s, true, []);
    expect(s.active).toBe(false);
  });
});
