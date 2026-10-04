import { HW } from './arena';
import { arrowCorners, circleTriangle } from './collide';
import { CONFIG } from './config';
import type { Arrow, Cannon, Player, World } from './types';

export function createCannons(): Cannon[] {
  const c = CONFIG.cannon;
  return [
    { x: -c.x, y: c.laneY, dir: 1, tip: -1 },
    { x: c.x, y: -c.laneY, dir: -1, tip: 1 },
  ];
}

/** Both cannons fire together every interval of world time. */
export function fireCannons(world: World, dt: number): void {
  world.cannonClock -= dt;
  while (world.cannonClock <= 0) {
    for (const c of world.cannons) {
      world.arrows.push({ x: c.x, y: c.y, px: c.x, dir: c.dir, tip: c.tip });
      world.events.push({ type: 'fire', x: c.x, y: c.y, dir: c.dir });
    }
    world.cannonClock += CONFIG.cannon.interval;
  }
}

/** Slides arrows along their lanes and drops the ones fully past the far wall. */
export function moveArrows(arrows: Arrow[], dt: number): void {
  const { arrowSpeed, arrowW } = CONFIG.cannon;
  let write = 0;
  for (const a of arrows) {
    a.px = a.x;
    a.x += a.dir * arrowSpeed * dt;
    const back = a.x - (a.dir * arrowW) / 2;
    if (a.dir > 0 ? back > HW : back < -HW) continue;
    arrows[write++] = a;
  }
  arrows.length = write;
}

export function arrowHits(a: Arrow, p: Player): boolean {
  const [A, B, C] = arrowCorners(a.x, a.y, a.tip, CONFIG.cannon.arrowW, CONFIG.cannon.arrowH);
  return circleTriangle(p.x, p.y, CONFIG.player.radius, A.x, A.y, B.x, B.y, C.x, C.y);
}
