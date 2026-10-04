import { CONFIG } from '../game/config';
import type { SimEvent, Vec, World } from '../game/types';
import { hexToRgb, type RGB } from './tween';

type Kind = 'dot' | 'shard' | 'confetti';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: Kind;
  rot: number;
  spin: number;
  gravity: number;
  drag: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  width: number;
  color: string;
}

interface Streak {
  x: number;
  y: number;
  angle: number;
  len: number;
  life: number;
  max: number;
}

export interface Fx {
  handle(events: SimEvent[], world: World): void;
  update(dt: number): void;
  /** Draws in world space: the caller sets the world transform. */
  draw(ctx: CanvasRenderingContext2D): void;
  /** World units. */
  shakeOffset(): Vec;
  flash(): { rgb: RGB; alpha: number };
  /** 0..1 glow on the arena frame (stage up, launches). */
  pulse(): number;
  /** True once a missile has burst into confetti at the win. */
  popped(id: number): boolean;
  reset(): void;
  stats(): { particles: number; rings: number; streaks: number };
}

const INK = CONFIG.colors.outline;
const WHITE = '#ffffff';
const RED = '#ff2a2a';
/** Peak shake in world units at full trauma; offset = trauma² × this. */
const SHAKE_UNITS = 9;
const POP_GAP = 0.12;
/** How long the dot flashes before it shatters; matches main.ts's hit-stop. */
export const DEATH_FLASH = 0.08;

type Range = readonly [number, number];
const pickIn = ([lo, hi]: Range) => lo + Math.random() * (hi - lo);

export function createFx(reducedMotion: boolean): Fx {
  const maxParticles = reducedMotion ? 250 : 600;
  const density = reducedMotion ? 0.5 : 1;
  let particles: Particle[] = [];
  let rings: Ring[] = [];
  let streaks: Streak[] = [];
  let pending: { at: number; run: () => void }[] = [];
  let popped = new Set<number>();
  let clock = 0;
  let trauma = 0;
  let flashRgb: RGB = hexToRgb(RED);
  let flashAlpha = 0;
  let pulse = 0;

  function burst(x: number, y: number, n: number, color: string, kind: Kind, speed: Range, life: Range, size: Range, gravity = 0, drag = 4) {
    const count = Math.round(n * density);
    for (let i = 0; i < count && particles.length < maxParticles; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = pickIn(speed);
      const l = pickIn(life);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: l,
        max: l,
        size: pickIn(size),
        color,
        kind,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 14,
        gravity,
        drag,
      });
    }
  }

  function ring(x: number, y: number, r0: number, r1: number, life: number, color: string, width = 2) {
    if (rings.length < 80) rings.push({ x, y, r0, r1, life, max: life, width, color });
  }

  function shake(amount: number) {
    if (!reducedMotion) trauma = Math.min(1, trauma + amount);
  }

  function flashWith(hex: string, alpha: number) {
    flashRgb = hexToRgb(hex);
    flashAlpha = Math.max(flashAlpha, reducedMotion ? alpha * 0.4 : alpha);
  }

  return {
    handle(events, world) {
      for (const e of events) {
        switch (e.type) {
          case 'blink':
            ring(e.x, e.y, 6, 22, 0.25, INK, 2.5);
            break;
          case 'launch': {
            const color = world.missiles[e.id]?.color ?? WHITE;
            ring(e.x, e.y, 4, 34, 0.35, color, 3);
            burst(e.x, e.y, 8, color, 'dot', [60, 160], [0.2, 0.4], [2, 4]);
            shake(0.45);
            pulse = Math.max(pulse, 0.6);
            break;
          }
          case 'bounce': {
            const k = Math.min(e.speed / 700, 1);
            // Dust puffs spread along the wall from the contact point.
            for (const side of [-1, 1]) {
              burst(e.x - e.ny * side * 2, e.y + e.nx * side * 2, 2 + Math.round(3 * k), WHITE, 'dot', [40, 40 + 120 * k], [0.15, 0.3], [1.5, 3]);
            }
            if (e.speed > 500) shake(0.15);
            break;
          }
          case 'nearMiss':
            if (streaks.length < 20) streaks.push({ x: e.x, y: e.y, angle: e.angle, len: 60, life: 0.25, max: 0.25 });
            break;
          case 'fire':
            burst(e.x + e.dir * 8, e.y, 3, WHITE, 'dot', [20, 60], [0.15, 0.25], [1.5, 2.5]);
            break;
          case 'stage':
            pulse = 1;
            flashWith(WHITE, 0.15);
            break;
          case 'slowmo':
            ring(world.player.x, world.player.y, 10, 90, 0.4, e.on ? INK : WHITE, 3);
            break;
          case 'death': {
            shake(1);
            flashWith(RED, 0.5);
            burst(e.hx, e.hy, 8, WHITE, 'dot', [80, 200], [0.2, 0.4], [2, 3.5]);
            // The dot flashes during the hit-stop (renderer), then shatters.
            const { x, y } = e;
            pending.push({
              at: clock + DEATH_FLASH,
              run: () => {
                ring(x, y, 10, 80, 0.5, INK, 4);
                burst(x, y, 14, WHITE, 'shard', [120, 320], [0.6, 1.1], [5, 9], 0, 2.5);
              },
            });
            break;
          }
          case 'win': {
            flashWith(WHITE, 0.3);
            let i = 0;
            for (const m of world.missiles) {
              if (m.state !== 'flying') continue;
              const { id, color } = m;
              const x = m.x;
              const y = m.y;
              pending.push({
                at: clock + i * POP_GAP,
                run: () => {
                  popped.add(id);
                  ring(x, y, 4, 40, 0.4, color, 3);
                  burst(x, y, 18, color, 'confetti', [120, 300], [0.8, 1.4], [3, 6], -500, 1.5);
                },
              });
              i++;
            }
            break;
          }
          case 'warn':
          case 'tick':
            break;
        }
      }
    },

    update(rawDt) {
      const dt = Math.max(0, rawDt); // effects only ever move forward
      clock += dt;
      if (pending.length > 0) {
        const due = pending.filter((p) => p.at <= clock);
        pending = pending.filter((p) => p.at > clock);
        for (const p of due) p.run();
      }
      // Age everything and compact in place: no new arrays every frame.
      let n = 0;
      for (const p of particles) {
        p.life -= dt;
        if (p.life <= 0) continue;
        const drag = Math.exp(-p.drag * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        particles[n++] = p;
      }
      particles.length = n;
      n = 0;
      for (const r of rings) if ((r.life -= dt) > 0) rings[n++] = r;
      rings.length = n;
      n = 0;
      for (const s of streaks) if ((s.life -= dt) > 0) streaks[n++] = s;
      streaks.length = n;
      trauma = Math.max(0, trauma - 1.8 * dt);
      flashAlpha *= Math.exp(-5 * dt);
      pulse *= Math.exp(-4 * dt);
    },

    draw(ctx) {
      for (const r of rings) {
        const t = 1 - r.life / r.max;
        const eased = 1 - (1 - t) ** 3;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(0, r.r0 + (r.r1 - r.r0) * eased), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      for (const s of streaks) {
        const t = s.life / s.max;
        ctx.globalAlpha = t;
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 2.5 * t;
        const dx = Math.cos(s.angle) * s.len;
        const dy = Math.sin(s.angle) * s.len;
        ctx.beginPath();
        ctx.moveTo(s.x - dx, s.y - dy);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      for (const p of particles) {
        const t = p.life / p.max;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.fillStyle = p.color;
        if (p.kind === 'dot') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, s / 2), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        if (p.kind === 'shard') {
          ctx.moveTo(s, 0);
          ctx.lineTo(-s * 0.6, s * 0.7);
          ctx.lineTo(-s * 0.4, -s * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else {
          ctx.rect(-s / 2, -s / 4, s, s / 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    shakeOffset() {
      if (trauma <= 0) return { x: 0, y: 0 };
      const m = trauma * trauma * SHAKE_UNITS;
      return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
    },

    flash() {
      return { rgb: flashRgb, alpha: flashAlpha };
    },

    pulse() {
      return pulse;
    },

    popped(id) {
      return popped.has(id);
    },

    stats() {
      return { particles: particles.length, rings: rings.length, streaks: streaks.length };
    },

    reset() {
      particles = [];
      rings = [];
      streaks = [];
      pending = [];
      popped = new Set();
      trauma = 0;
      flashAlpha = 0;
      pulse = 0;
    },
  };
}
