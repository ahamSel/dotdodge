/** Squash & stretch for the dot: a damped spring on how stretched it is along its motion. */

export interface DotPose {
  /** Axis of the stretch (radians, world space). */
  angle: number;
  /** Scale along the axis (>1 stretched, <1 squashed) and across it. */
  along: number;
  across: number;
  /** Centre offset in radii, pulling a squashed dot toward the wall it hit so it keeps touching it. */
  shiftX: number;
  shiftY: number;
}

export interface DotMotion {
  update(vx: number, vy: number, dt: number): void;
  /** `nx, ny`: the wall's normal (into the arena); `speed`: impact speed. */
  bounce(nx: number, ny: number, speed: number): void;
  pose(): DotPose;
  reset(): void;
}

// Tuned for DotDodge speeds (the dot cruises at 200–900 u/s). Re-tune at real size in the browser.
const MAX_STRETCH = 0.16;
const REF_SPEED = 900;
const STIFFNESS = 380;
const DAMPING = 14; // underdamped: a squash overshoots back into a small stretch
const BOUNCE_SQUASH = 9;
const BOUNCE_REF = 600;
const ANCHOR_TIME = 0.18;
const SUBSTEP = 1 / 240;

export function createMotion(): DotMotion {
  let dirX = 1;
  let dirY = 0;
  let a = 0;
  let av = 0;
  let wallX = 0;
  let wallY = 0;
  let wallT = Infinity;

  return {
    update(vx, vy, dt) {
      if (dt <= 0) return;
      const speed = Math.hypot(vx, vy);
      if (speed > 20) {
        const k = 1 - Math.exp(-25 * dt);
        const nx = dirX + (vx / speed - dirX) * k;
        const ny = dirY + (vy / speed - dirY) * k;
        const m = Math.hypot(nx, ny) || 1;
        dirX = nx / m;
        dirY = ny / m;
      }
      const target = Math.min(speed / REF_SPEED, 1) * MAX_STRETCH;
      for (let left = dt; left > 0; left -= SUBSTEP) {
        const h = Math.min(left, SUBSTEP);
        av += (STIFFNESS * (target - a) - DAMPING * av) * h;
        a += av * h;
      }
      wallT += dt;
    },
    bounce(nx, ny, speed) {
      dirX = nx;
      dirY = ny;
      av -= BOUNCE_SQUASH * Math.min(speed / BOUNCE_REF, 1.5);
      wallX = nx;
      wallY = ny;
      wallT = 0;
    },
    pose() {
      let shiftX = 0;
      let shiftY = 0;
      if (wallT < ANCHOR_TIME && a < 0) {
        const fade = 1 - wallT / ANCHOR_TIME;
        shiftX = wallX * a * fade; // a < 0: toward the wall
        shiftY = wallY * a * fade;
      }
      return { angle: Math.atan2(dirY, dirX), along: 1 + a, across: 1 / (1 + a), shiftX, shiftY };
    },
    reset() {
      dirX = 1;
      dirY = 0;
      a = 0;
      av = 0;
      wallT = Infinity;
    },
  };
}
