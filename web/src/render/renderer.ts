import { HH, HW } from '../game/arena';
import { arrowCorners } from '../game/collide';
import { CONFIG } from '../game/config';
import { lastBlinkStart, warningLit } from '../game/schedule';
import { timeScale } from '../game/slowmo';
import type { Missile, SimEvent, World } from '../game/types';
import type { JoystickView } from '../input/touch';
import { DEATH_FLASH, type Fx } from './fx';
import { createMotion } from './motion';
import { capsulePath, chevronPath, roundRectPath } from './shapes';
import { createTrail, type Trail } from './trails';
import { approach, clamp01, hexToRgb, lerp, lerpAngle, mixRgb, rgbToCss, type RGB } from './tween';
import { fitView, worldMatrix, type View } from './view';

const TAU = Math.PI * 2;
const INK = CONFIG.colors.outline;
const FIELD = hexToRgb(CONFIG.colors.field);
const SLOW_FIELD = hexToRgb('#c8a46e'); // desaturated, slightly darker orange
const WHITE = hexToRgb('#ffffff');
const VIGNETTE: RGB = [20, 0, 40];
/** Three cartoon speed lines behind each missile: [offset across, length]. */
const SPEED_LINES: readonly [number, number][] = [
  [-3.4, 9],
  [0, 14],
  [3.4, 7],
];

export interface Renderer {
  /** Re-reads the canvas CSS size and returns the new view. */
  resize(): View;
  view(): View;
  /** `world` is null on the title screen (an empty arena). */
  draw(world: World | null, fx: Fx, alpha: number, joystick: JoystickView | null, dt: number): void;
  /** Sim events that drive renderer-side animation (squash). */
  onEvents(events: SimEvent[], world: World): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  let dpr = 1;
  let view: View = fitView(1, 1);
  let clock = 0;
  let slow = 0;
  let lastWorld: World | null = null;
  const motion = createMotion();
  const playerTrail = createTrail();
  let missileTrails: Trail[] = [];
  /** Where and when the dot was caught, for its flash before it shatters. */
  let caught: { x: number; y: number; at: number } | null = null;

  /** A new run starts from a clean slate. */
  function sync(world: World) {
    if (world === lastWorld) return;
    lastWorld = world;
    motion.reset();
    playerTrail.clear();
    missileTrails = world.missiles.map(() => createTrail());
    slow = 0;
    caught = null;
  }

  function resize(): View {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view = fitView(w, h);
    return view;
  }
  resize();

  /** Outline width in world units: never thinner than 2 CSS px. */
  const line = () => Math.max(CONFIG.outline, 2 / view.scale);

  function fieldPath() {
    ctx.beginPath();
    roundRectPath(ctx, -HW, -HH, 2 * HW, 2 * HH, CONFIG.arena.corner);
  }

  function drawWarnings(world: World) {
    if (world.phase !== 'intro' && world.phase !== 'running') return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const m of world.missiles) {
      if (m.state !== 'warning') continue;
      const t = world.time - m.warnAt;
      if (!warningLit(t)) continue;
      const pop = 1 + 0.35 * (1 - clamp01((t - lastBlinkStart(t)) / 0.12));
      const inward = Math.atan2(-m.warnY, -m.warnX);
      ctx.save();
      ctx.translate(m.warnX + Math.cos(inward) * 22, m.warnY + Math.sin(inward) * 22);
      ctx.rotate(inward);
      ctx.scale(pop, pop);
      ctx.beginPath();
      chevronPath(ctx, 24);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawArrows(world: World, alpha: number, lw: number) {
    const { arrowW, arrowH } = CONFIG.cannon;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 0.7;
    ctx.lineJoin = 'round';
    for (const a of world.arrows) {
      const [A, B, C] = arrowCorners(lerp(a.px, a.x, alpha), a.y, a.tip, arrowW, arrowH);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function missileVisible(m: Missile, fx: Fx) {
    return (m.state === 'flying' || m.state === 'coasting') && !fx.popped(m.id);
  }

  function drawMissiles(world: World, fx: Fx, alpha: number, dt: number, lw: number) {
    const { length, radius } = CONFIG.missile;
    const trailAge = 0.22 * (1 + slow * 2);
    world.missiles.forEach((m, i) => {
      if (!missileVisible(m, fx)) return;
      const x = lerp(m.px, m.x, alpha);
      const y = lerp(m.py, m.y, alpha);
      const trail = missileTrails[i];
      if (dt > 0) trail.push(x, y, clock);
      trail.draw(ctx, clock, trailAge, radius * 1.6, m.color);
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const m of world.missiles) {
      if (!missileVisible(m, fx)) continue;
      ctx.save();
      ctx.translate(lerp(m.px, m.x, alpha), lerp(m.py, m.y, alpha));
      ctx.rotate(lerpAngle(m.pangle, m.angle, alpha));
      const back = -length / 2 - 4;
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      for (const [oy, len] of SPEED_LINES) {
        ctx.moveTo(back, oy);
        ctx.lineTo(back - len, oy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      capsulePath(ctx, length, radius);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.lineWidth = lw * 0.75;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(world: World, alpha: number, dt: number, lw: number) {
    const p = world.player;
    const r = CONFIG.player.radius;
    if (!p.alive) {
      // Caught: the dot flips to black and swells for the hit-stop, then the shards take over.
      if (caught && clock - caught.at < DEATH_FLASH) {
        const k = (clock - caught.at) / DEATH_FLASH;
        ctx.beginPath();
        ctx.arc(caught.x, caught.y, r * (1.1 + 0.25 * k), 0, TAU);
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      return;
    }
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    const ts = timeScale(world.slowmo);
    motion.update(p.vx * ts, p.vy * ts, dt);
    if (dt > 0) playerTrail.push(x, y, clock);
    playerTrail.draw(ctx, clock, 0.16 * (1 + slow * 2), r * 1.3, 'rgba(255,255,255,0.6)');
    const pose = motion.pose();
    ctx.save();
    ctx.translate(x + pose.shiftX * r, y + pose.shiftY * r);
    ctx.rotate(pose.angle);
    ctx.scale(pose.along, pose.across);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = CONFIG.colors.player;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  function drawJoystick(j: JoystickView) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(j.ax, j.ay, j.radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(j.kx, j.ky, j.radius * 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  /** Full-screen edge glows, built once per screen size and colour; opacity is applied when drawing. */
  const glows = new Map<string, CanvasGradient>();
  function edgeGlow(rgb: RGB): CanvasGradient {
    const w = view.cssW;
    const h = view.cssH;
    const key = `${w}x${h}:${rgb.join()}`;
    let g = glows.get(key);
    if (!g) {
      if (glows.size > 8) glows.clear();
      g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, rgbToCss(rgb, 0));
      g.addColorStop(1, rgbToCss(rgb, 1));
      glows.set(key, g);
    }
    return g;
  }

  function drawOverlays(fx: Fx) {
    if (slow > 0.01) {
      ctx.globalAlpha = 0.45 * slow;
      ctx.fillStyle = edgeGlow(VIGNETTE);
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    }
    const f = fx.flash();
    if (f.alpha >= 0.01) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = edgeGlow(f.rgb);
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    }
    ctx.globalAlpha = 1;
  }

  return {
    resize,
    view: () => view,
    onEvents(events, world) {
      sync(world);
      for (const e of events) {
        if (e.type === 'bounce') motion.bounce(e.nx, e.ny, e.speed);
        else if (e.type === 'death') {
          playerTrail.clear();
          caught = { x: e.x, y: e.y, at: clock };
        }
      }
    },
    draw(world, fx, alpha, joystick, rawDt) {
      const dt = Math.max(0, rawDt);
      clock += dt;
      if (world) sync(world);
      slow = approach(slow, world?.slowmo.active ? 1 : 0, 8, dt);
      const pulse = fx.pulse();
      const lw = line();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = CONFIG.colors.frame;
      ctx.fillRect(0, 0, view.cssW, view.cssH);

      const [a, b, c, d, e, f] = worldMatrix(view);
      ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
      const shake = fx.shakeOffset();
      ctx.translate(shake.x, shake.y);

      fieldPath();
      ctx.fillStyle = rgbToCss(mixRgb(mixRgb(FIELD, SLOW_FIELD, slow * 0.7), WHITE, pulse * 0.12));
      ctx.fill();

      if (world) {
        ctx.save();
        fieldPath();
        ctx.clip();
        drawWarnings(world);
        drawArrows(world, alpha, lw);
        drawMissiles(world, fx, alpha, dt, lw);
        drawPlayer(world, alpha, dt, lw);
        fx.draw(ctx);
        ctx.restore();
      }

      fieldPath();
      ctx.lineWidth = lw * 1.6 * (1 + pulse * 0.6);
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (joystick) drawJoystick(joystick);
      drawOverlays(fx);
    },
  };
}
