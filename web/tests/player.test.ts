import { describe, expect, it } from 'vitest';
import { HW } from '../src/game/arena';
import { CONFIG } from '../src/game/config';
import { createPlayer, updatePlayer } from '../src/game/player';
import type { SimEvent } from '../src/game/types';

const DT = 1 / 60;
const DAMP = 1 / (1 + CONFIG.player.drag * DT);
const R = CONFIG.player.radius;

describe('player', () => {
  it('accelerates at the thrust rate, then Box2D damping applies', () => {
    const p = createPlayer();
    updatePlayer(p, { x: 1, y: 0 }, 1400, DT, []);
    expect(p.vx).toBeCloseTo(1400 * DT * DAMP, 6);
    expect(p.vy).toBe(0);
    expect(p.x).toBeCloseTo(p.vx * DT, 6);
  });

  it('coasts with drag 0.5: about 61% of the speed is left after a second', () => {
    const p = createPlayer();
    p.x = -(HW - R); // start at the left wall so a full second of coasting never reaches the right one
    p.vx = 600;
    for (let i = 0; i < 60; i++) updatePlayer(p, { x: 0, y: 0 }, 1400, DT, []);
    expect(p.vx).toBeCloseTo(600 * DAMP ** 60, 6);
    expect(p.vx / 600).toBeGreaterThan(0.6);
    expect(p.vx / 600).toBeLessThan(0.62);
  });

  it('never thrusts harder than full stick (diagonals are normalised)', () => {
    const p = createPlayer();
    updatePlayer(p, { x: 1, y: 1 }, 1400, DT, []);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(1400 * DT * DAMP, 6);
  });

  it('bounces off a wall once, keeping 55% of the impact speed', () => {
    const p = createPlayer();
    p.x = HW - R - 1;
    p.vx = 600;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.x).toBe(HW - R);
    expect(p.vx).toBeCloseTo(-0.55 * 600 * DAMP, 6);
    expect(events).toHaveLength(1);
    const e = events[0] as Extract<SimEvent, { type: 'bounce' }>;
    expect(e).toMatchObject({ type: 'bounce', nx: -1, ny: 0 });
    expect(e.x).toBeCloseTo(HW, 9); // the contact point is on the wall
    expect(e.speed).toBeCloseTo(600 * DAMP, 6);
  });

  it('always pushes off at least 180 u/s, silently when the touch was soft', () => {
    const p = createPlayer();
    p.x = HW - R;
    p.vx = 10;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.vx).toBe(-180);
    expect(events).toHaveLength(0);
  });

  it('bounces off the floor and ceiling too', () => {
    const p = createPlayer();
    p.y = -(CONFIG.arena.hh - R) + 1;
    p.vy = -500;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.vy).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'bounce', nx: 0, ny: 1 });
  });

  it('does nothing once dead, apart from settling its previous position', () => {
    const p = createPlayer();
    p.alive = false;
    p.x = 5;
    updatePlayer(p, { x: 1, y: 0 }, 1400, DT, []);
    expect(p.x).toBe(5);
    expect(p.px).toBe(5);
    expect(p.vx).toBe(0);
  });
});
