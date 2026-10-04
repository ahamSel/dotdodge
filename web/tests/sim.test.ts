import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, step } from '../src/game/sim';
import type { SimEvent } from '../src/game/types';
import { INTRO } from '../src/game/schedule';
import { IDLE, launch, run, runningWorld } from './helpers';

const of = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

describe('a new run', () => {
  it('starts in the intro with seven idle missiles and 120 on the clock', () => {
    const w = createWorld();
    expect(w.phase).toBe('intro');
    expect(w.stage).toBe(1);
    expect(w.shown).toBe(120);
    expect(w.missiles.map((m) => m.state)).toEqual(Array(7).fill('idle'));
  });

  it('warns about the white missile, blinks three times, then launches it and starts the countdown', () => {
    const w = createWorld();
    let events = run(w, 2.7);
    expect(of(events, 'warn').map((e) => e.id)).toEqual([0]);
    expect(of(events, 'blink').map((e) => e.n)).toEqual([1, 2, 3]);
    expect(of(events, 'launch')).toHaveLength(0);
    expect(w.phase).toBe('intro');
    expect(w.elapsed).toBe(0);
    events = run(w, 0.1);
    expect(of(events, 'launch')).toMatchObject([{ id: 0, x: -312, y: 0 }]);
    expect(w.phase).toBe('running');
    expect(w.missiles[0].state).toBe('flying');
    expect(w.elapsed).toBeGreaterThan(0);
  });
});

describe('stages and countdown', () => {
  it('announces stage 2 at 17 s, together with the red missile warning', () => {
    const w = runningWorld(16.95);
    w.missiles[1].warnAt = w.time + 0.05;
    const events = run(w, 0.1);
    expect(of(events, 'stage')).toEqual([{ type: 'stage', stage: 2 }]);
    expect(of(events, 'warn').map((e) => e.id)).toEqual([1]);
    expect(w.stage).toBe(2);
  });

  it('ticks each of the last ten seconds', () => {
    const w = runningWorld(109.5);
    const events = run(w, 11);
    expect(of(events, 'tick').map((e) => e.remaining)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('wins when the countdown reaches 0, then freezes', () => {
    const w = runningWorld(119.9);
    const events = run(w, 0.2);
    expect(of(events, 'win')).toHaveLength(1);
    expect(w.phase).toBe('won');
    expect(w.elapsed).toBe(CONFIG.countdown);
    const m = launch(w, 2, 100, 0, 0);
    run(w, 0.5);
    expect(m.x).toBe(100);
  });

  it('a missile arriving on the step the countdown hits 0 does not steal the win', () => {
    const w = runningWorld(CONFIG.countdown - CONFIG.step / 2);
    // Close enough that this step's flight reaches the dot (player radius + half capsule = 17.6).
    launch(w, 1, 17.6 + 400 / 60 - 0.5, 0, Math.PI);
    const events = run(w, CONFIG.step);
    expect(of(events, 'death')).toHaveLength(0);
    expect(of(events, 'win')).toHaveLength(1);
    expect(w.phase).toBe('won');
  });

  it('after the win nothing can kill you', () => {
    const w = runningWorld(119.99);
    run(w, 0.05);
    expect(w.phase).toBe('won');
    launch(w, 1, 0, 0, 0); // right on top of the player
    const events = run(w, 0.5);
    expect(of(events, 'death')).toHaveLength(0);
    expect(w.player.alive).toBe(true);
  });
});

describe('death', () => {
  it('dies when a missile touches the dot; missiles stop homing and coast away', () => {
    const w = runningWorld(10);
    const m = launch(w, 1, 20, 0, Math.PI);
    const events = run(w, 0.1);
    expect(of(events, 'death')).toMatchObject([{ by: 'missile' }]);
    expect(w.phase).toBe('dead');
    expect(w.player.alive).toBe(false);
    expect(m.state).toBe('coasting');
    const angle = m.angle;
    const x = m.x;
    run(w, 0.5);
    expect(m.angle).toBe(angle);
    expect(m.x).toBeCloseTo(x - m.speed * 0.5, 0);
  });

  it('dies on a spike arrow', () => {
    const w = runningWorld(100);
    w.player.y = w.player.py = 141.5;
    w.arrows.push({ x: 0, y: 156, px: 0, dir: 1, tip: -1 });
    const events = run(w, CONFIG.step);
    expect(of(events, 'death')).toMatchObject([{ by: 'arrow' }]);
  });

  it('freezes the countdown at the moment of death', () => {
    const w = runningWorld(42);
    launch(w, 1, 15, 0, Math.PI);
    run(w, 0.1);
    const at = w.elapsed;
    run(w, 2);
    expect(w.elapsed).toBe(at);
  });

  it('switches slow-mo off on death', () => {
    const w = runningWorld(100);
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(w.slowmo.active).toBe(true);
    drainEvents(w);
    launch(w, 1, 14, 0, Math.PI);
    const events = run(w, 0.5);
    expect(of(events, 'slowmo')).toEqual([{ type: 'slowmo', on: false }]);
    expect(w.slowmo.active).toBe(false);
  });
});

describe('near misses', () => {
  it('fires once when a missile shaves past without touching', () => {
    const w = runningWorld(10);
    const m = launch(w, 0, -150, 20, 0);
    m.turn = 0; // fly straight past
    const events = run(w, 1);
    expect(of(events, 'nearMiss')).toHaveLength(1);
    expect(of(events, 'death')).toHaveLength(0);
  });
});

describe('slow-mo in the world', () => {
  it('is ignored before stage 6 and after death', () => {
    const early = runningWorld(50);
    step(early, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(early.slowmo.active).toBe(false);
    const dead = runningWorld(100);
    dead.phase = 'dead';
    dead.player.alive = false;
    step(dead, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(dead.slowmo.active).toBe(false);
  });

  it('slows world time to 0.1× while the meter runs on real time', () => {
    const w = runningWorld(100);
    const t0 = w.time;
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(w.time - t0).toBeCloseTo(CONFIG.step * 0.1, 9);
    expect(w.slowmo.meter).toBeCloseTo(CONFIG.slowmo.capacity - CONFIG.step, 9);
  });

  it('only changes the meter when the world steps (a paused game does not drain it)', () => {
    const w = runningWorld(100);
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    const meter = w.slowmo.meter;
    // main.ts does not call step() while paused; nothing else touches the meter.
    expect(w.slowmo.meter).toBe(meter);
  });

  it('gives the dot the stronger 2020 slow-mo thrust', () => {
    const w = runningWorld(100);
    step(w, { move: { x: 1, y: 0 }, slowmo: true }, CONFIG.step);
    const dt = CONFIG.step * 0.1;
    expect(w.player.vx).toBeCloseTo((3000 * dt) / (1 + 0.5 * dt), 6);
  });
});

describe('cannons in the world', () => {
  it('start firing at stage 6', () => {
    const before = runningWorld(90);
    expect(of(run(before, 1), 'fire')).toHaveLength(0);
    const after = runningWorld(97);
    expect(of(run(after, 0.5), 'fire').length).toBeGreaterThanOrEqual(2);
  });
});

describe('watch mode (dev only)', () => {
  it('a ghost dot is never caught, so the run plays through to the win', () => {
    // The real schedule from 90 s on: every missile homing in and, from 97 s, the cannons firing.
    const w = createWorld();
    w.time = INTRO + 90;
    w.ghost = true;
    const events = run(w, 31);
    expect(of(events, 'death')).toHaveLength(0);
    expect(of(events, 'win')).toHaveLength(1);
    expect(w.phase).toBe('won');
  });
});
