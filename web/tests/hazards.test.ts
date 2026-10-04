import { describe, expect, it } from 'vitest';
import { HW } from '../src/game/arena';
import { arrowHits, createCannons, fireCannons, moveArrows } from '../src/game/hazards';
import { createPlayer } from '../src/game/player';
import type { Arrow, World } from '../src/game/types';

/** Just the parts of a world the cannons touch. */
const cannonWorld = () => ({ cannons: createCannons(), arrows: [], cannonClock: 0, events: [] }) as unknown as World;

describe('cannons', () => {
  it('sit just outside the top-left and bottom-right walls, facing across', () => {
    expect(createCannons()).toEqual([
      { x: -319, y: 156, dir: 1, tip: -1 },
      { x: 319, y: -156, dir: -1, tip: 1 },
    ]);
  });

  it('both fire at once, then every 0.3 s of world time', () => {
    const w = cannonWorld();
    fireCannons(w, 0);
    expect(w.arrows).toHaveLength(2);
    expect(w.events.filter((e) => e.type === 'fire')).toHaveLength(2);
    fireCannons(w, 0.29);
    expect(w.arrows).toHaveLength(2);
    fireCannons(w, 0.02);
    expect(w.arrows).toHaveLength(4);
  });

  it('fires four volleys in just under a second', () => {
    const w = cannonWorld();
    for (let i = 0; i < 14; i++) fireCannons(w, 0.07);
    expect(w.arrows).toHaveLength(8);
  });
});

describe('arrows', () => {
  const arrow = (x: number, dir: 1 | -1): Arrow => ({ x, y: 156, px: x, dir, tip: -1 });

  it('slide along their lane at 70 u/s', () => {
    const arrows = [arrow(-319, 1)];
    moveArrows(arrows, 1);
    expect(arrows[0].x).toBeCloseTo(-249);
    expect(arrows[0].px).toBe(-319);
  });

  it('are removed once fully past the far wall', () => {
    const arrows = [arrow(HW + 5, 1), arrow(HW + 7, 1), arrow(-HW - 7, -1)];
    moveArrows(arrows, 0);
    expect(arrows.map((a) => a.x)).toEqual([HW + 5]);
  });

  it('kill a player who touches them', () => {
    const p = createPlayer();
    p.x = 0;
    p.y = 141.5;
    expect(arrowHits(arrow(0, 1), p)).toBe(true);
    p.y = 140;
    expect(arrowHits(arrow(0, 1), p)).toBe(false);
  });
});
