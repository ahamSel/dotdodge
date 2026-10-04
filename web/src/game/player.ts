import { HH, HW } from './arena';
import { CONFIG } from './config';
import type { Player, SimEvent, Vec } from './types';

export function createPlayer(): Player {
  return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, alive: true };
}

/** Thrust, Box2D-style linear damping (drag 0.5, as the 2020 Rigidbody2D), move, then bounce off the walls. */
export function updatePlayer(p: Player, move: Vec, thrust: number, dt: number, events: SimEvent[]): void {
  p.px = p.x;
  p.py = p.y;
  if (!p.alive) return;
  let ix = move.x;
  let iy = move.y;
  const m = Math.hypot(ix, iy);
  if (m > 1) {
    ix /= m;
    iy /= m;
  }
  p.vx += ix * thrust * dt;
  p.vy += iy * thrust * dt;
  const damp = 1 / (1 + CONFIG.player.drag * dt);
  p.vx *= damp;
  p.vy *= damp;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  bounce(p, events);
}

/** One clean bounce per contact: 55% of the impact speed comes back, never less than 180 u/s. */
function bounce(p: Player, events: SimEvent[]): void {
  const { radius: r, restitution, minBounce, bounceEventSpeed } = CONFIG.player;
  const lx = HW - r;
  const ly = HH - r;
  // nx, ny: the wall's normal, pointing into the arena. vn: speed into the wall (≥ 0).
  const hit = (nx: number, ny: number, vn: number) => {
    if (vn > bounceEventSpeed) events.push({ type: 'bounce', x: p.x - nx * r, y: p.y - ny * r, nx, ny, speed: vn });
    return Math.max(restitution * vn, minBounce);
  };
  if (p.x < -lx) {
    p.x = -lx;
    p.vx = hit(1, 0, Math.max(0, -p.vx));
  } else if (p.x > lx) {
    p.x = lx;
    p.vx = -hit(-1, 0, Math.max(0, p.vx));
  }
  if (p.y < -ly) {
    p.y = -ly;
    p.vy = hit(0, 1, Math.max(0, -p.vy));
  } else if (p.y > ly) {
    p.y = ly;
    p.vy = -hit(0, -1, Math.max(0, p.vy));
  }
}
