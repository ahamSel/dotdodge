import { HH, HW } from '../game/arena';
import { arrowCorners } from '../game/collide';
import { CONFIG } from '../game/config';
import { lastBlinkStart, warningLit } from '../game/schedule';
import { timeScale } from '../game/slowmo';
import type { Missile, SimEvent, World } from '../game/types';
import type { JoystickView } from '../input/touch';
import type { Fx } from './fx';
import { createMotion } from './motion';
import { capsulePath, chevronPath, roundRectPath } from './shapes';
import { createTrail, type Trail } from './trails';
import { approach, clamp01, easeOutBack, hexToRgb, lerp, lerpAngle, mixRgb, rgbToCss } from './tween';
import { fitView, worldMatrix, type View } from './view';

const TAU = Math.PI * 2;
const INK = CONFIG.colors.outline;
const FIELD = hexToRgb(CONFIG.colors.field);
const SLOW_FIELD = hexToRgb('#c8a46e'); // desaturated, slightly darker orange
const WHITE = hexToRgb('#ffffff');
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
  /** Sim events that drive renderer-side animation (squash, cannon recoil). */
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
  const recoil = [0, 0];

  /** A new run starts from a clean slate. */
  function sync(world: World) {
    if (world === lastWorld) return;
    lastWorld = world;
    motion.reset();
    playerTrail.clear();
    missileTrails = world.missiles.map(() => createTrail());
    recoil[0] = recoil[1] = 0;
    slow = 0;
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
    if (!p.alive) return;
    const r = CONFIG.player.radius;
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

  function drawCannons(world: World, lw: number, dt: number) {
    const t = world.elapsed - CONFIG.cannon.startAt;
    if (t < 0) return;
    const s = easeOutBack(clamp01(t / 0.35));
    world.cannons.forEach((c, i) => {
      recoil[i] = Math.max(0, recoil[i] - dt * 8);
      const back = -recoil[i] * 4;
      ctx.save();
      // Mounted in the corner wall (the 2020 spot, x = ±319, falls off-screen in a tight frame); arrows still spawn behind it.
      ctx.translate(-c.dir * (HW - 4), c.y);
      ctx.scale(c.dir * s, s);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      roundRectPath(ctx, -14 + back, -7, 20, 14, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(6 + back, 0, 3, 7, 0, 0, TAU);
      ctx.fillStyle = '#bdbdbd';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
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

  function drawOverlays(fx: Fx) {
    const w = view.cssW;
    const h = view.cssH;
    if (slow > 0.01) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(20,0,40,0)');
      g.addColorStop(1, `rgba(20,0,40,${0.45 * slow})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    const f = fx.flash();
    if (f.alpha >= 0.01) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, rgbToCss(f.rgb, 0));
      g.addColorStop(1, rgbToCss(f.rgb, f.alpha));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  return {
    resize,
    view: () => view,
    onEvents(events, world) {
      sync(world);
      for (const e of events) {
        if (e.type === 'bounce') motion.bounce(e.nx, e.ny, e.speed);
        else if (e.type === 'fire') recoil[e.dir > 0 ? 0 : 1] = 1;
        else if (e.type === 'death') playerTrail.clear();
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
        drawCannons(world, lw, dt);
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
