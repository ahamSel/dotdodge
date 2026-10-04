import { clamp, HH, HW, wallPoint } from './arena';
import { circleCapsuleGap } from './collide';
import { CONFIG } from './config';
import { launchTimeOf, warnTimeOf } from './schedule';
import type { Missile, Player } from './types';

const DEG = Math.PI / 180;

export function createMissiles(): Missile[] {
  return CONFIG.missiles.map((d, id) => {
    const w = wallPoint(d.x, d.y);
    const angle = Math.atan2(-d.y, -d.x); // facing the arena centre
    return {
      id,
      color: d.color,
      speed: d.speed,
      turn: d.turn * DEG,
      state: 'idle',
      x: d.x,
      y: d.y,
      px: d.x,
      py: d.y,
      angle,
      pangle: angle,
      spawnX: d.x,
      spawnY: d.y,
      warnX: w.x,
      warnY: w.y,
      warnAt: warnTimeOf(id),
      launchAt: launchTimeOf(id),
      blinks: 0,
      entered: false,
      nearArmed: true,
      lastGap: Infinity,
    };
  });
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function fly(m: Missile, dt: number): void {
  m.x += Math.cos(m.angle) * m.speed * dt;
  m.y += Math.sin(m.angle) * m.speed * dt;
}

/** Turns toward the target at sin(error) × turn rate (the 2020 HomingMissile formula) and flies on. */
export function steer(m: Missile, tx: number, ty: number, dt: number): void {
  const err = wrapAngle(Math.atan2(ty - m.y, tx - m.x) - m.angle);
  m.angle = wrapAngle(m.angle + Math.sin(err) * m.turn * dt);
  fly(m, dt);
}

/** A missile flies in from outside; once fully inside the arena it stays inside. */
export function keepInside(m: Missile): void {
  const e = CONFIG.missile.enterMargin;
  const lx = HW - e;
  const ly = HH - e;
  if (!m.entered) {
    if (Math.abs(m.x) > lx || Math.abs(m.y) > ly) return;
    m.entered = true;
  }
  m.x = clamp(m.x, -lx, lx);
  m.y = clamp(m.y, -ly, ly);
}

/** Overlapping flying missiles are pushed apart so they never merge into one blob. */
export function separate(missiles: Missile[]): void {
  const d0 = CONFIG.missile.separation;
  for (let i = 0; i < missiles.length; i++) {
    const a = missiles[i];
    if (a.state !== 'flying') continue;
    for (let j = i + 1; j < missiles.length; j++) {
      const b = missiles[j];
      if (b.state !== 'flying') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= d0) continue;
      const nx = d > 0 ? dx / d : 1;
      const ny = d > 0 ? dy / d : 0;
      const push = (d0 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

export function updateMissiles(missiles: Missile[], player: Player, dt: number): void {
  for (const m of missiles) {
    m.px = m.x;
    m.py = m.y;
    m.pangle = m.angle;
    if (m.state === 'flying') steer(m, player.x, player.y, dt);
    else if (m.state === 'coasting') fly(m, dt);
  }
  separate(missiles);
  for (const m of missiles) if (m.state === 'flying') keepInside(m);
}

/** Gap between a missile's capsule and the player's circle (negative = touching). */
export function gapToPlayer(m: Missile, p: Player): number {
  return circleCapsuleGap(p.x, p.y, CONFIG.player.radius, m.x, m.y, m.angle, CONFIG.missile.length, CONFIG.missile.radius);
}
