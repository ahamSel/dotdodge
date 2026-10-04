// Stages a cover with the real sim + renderer and saves it as a PNG (see tools/vite.config.ts).
import '../src/ui/styles.css'; // loads the Tektur @font-face
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, step } from '../src/game/sim';
import type { World } from '../src/game/types';
import { createFx } from '../src/render/fx';
import { createRenderer } from '../src/render/renderer';
import { capsulePath, roundRectPath } from '../src/render/shapes';

const DPR = 2;
const log = (msg: string) => document.getElementById('log')!.insertAdjacentHTML('beforeend', `<p>${msg}</p>`);

// The renderer sizes itself from devicePixelRatio; pin it so output is exactly DPR× the CSS size.
Object.defineProperty(window, 'devicePixelRatio', { get: () => DPR });

function stage(cssW: number, cssH: number) {
  const canvas = document.createElement('canvas');
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  document.body.append(canvas);
  const renderer = createRenderer(canvas);
  const world = createWorld();
  for (const m of world.missiles) m.warnAt = m.launchAt = Infinity;
  world.phase = 'running';
  return { canvas, renderer, world, fx: createFx(false) };
}

function fly(world: World, id: number, x: number, y: number, angle: number) {
  Object.assign(world.missiles[id], { state: 'flying', entered: true, x, y, px: x, py: y, angle, pangle: angle });
}

/** Runs the real sim and renderer for a few frames so trails form, with the dot held still. */
function settle(s: ReturnType<typeof stage>, seconds: number) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    step(s.world, { move: { x: 0, y: 0 }, slowmo: false }, CONFIG.step);
    const events = drainEvents(s.world).filter((e) => e.type !== 'nearMiss');
    s.fx.handle(events, s.world);
    s.renderer.onEvents(events, s.world);
    s.fx.update(CONFIG.step);
    s.renderer.draw(s.world, s.fx, 1, null, CONFIG.step);
  }
}

function outlinedText(canvas: HTMLCanvasElement, text: string, cx: number, cy: number, size: number) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.font = `condensed 900 ${size}px Tektur`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = size * 0.11;
  ctx.fillStyle = '#000';
  ctx.fillText(text, cx, cy + size * 0.08); // drop shadow
  ctx.strokeText(text, cx, cy + size * 0.08);
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, cx, cy);
}

async function save(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  const res = await fetch(`/__save?name=${name}`, { method: 'POST', body: blob });
  log(`${await res.text()} (${canvas.width}×${canvas.height})`);
}

/**
 * The cover in the 2020 app icon's style: the dot in a square arena, the seven missiles closing in on it with
 * speed lines behind them. itch also shrinks the cover's centre square to make the page's tab icon, so the
 * arena is a centred square that survives that crop whole.
 */
async function cover() {
  const W = 630;
  const H = 500;
  const S = 440; // arena card size
  const out = document.createElement('canvas');
  out.width = W * DPR;
  out.height = H * DPR;
  out.style.width = `${W}px`;
  out.style.height = `${H}px`;
  document.body.append(out);
  const ctx = out.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = CONFIG.colors.frame;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  roundRectPath(ctx, (W - S) / 2, (H - S) / 2, S, S, S * 0.1);
  ctx.fillStyle = CONFIG.colors.field;
  ctx.fill();
  ctx.lineWidth = S * 0.022;
  ctx.strokeStyle = CONFIG.colors.outline;
  ctx.stroke();

  ctx.translate(W / 2, H / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // [missile, direction from the dot (degrees), distance] as laid out on the 2020 icon.
  const ring: [number, number, number][] = [
    [0, 180, 0.25], [6, -136, 0.24], [5, -76, 0.235], [1, -11, 0.25],
    [3, 31, 0.24], [2, 81, 0.25], [4, 136, 0.235],
  ];
  const len = S * 0.15;
  const rad = S * 0.024;
  for (const [id, deg, dist] of ring) {
    const a = (deg * Math.PI) / 180;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(dist * S, 0);
    ctx.beginPath();
    capsulePath(ctx, len, rad);
    ctx.fillStyle = CONFIG.missiles[id].color;
    ctx.fill();
    ctx.lineWidth = S * 0.014;
    ctx.stroke();
    // Speed lines trail out past the missile's tail, away from the dot.
    ctx.lineWidth = S * 0.009;
    for (const [off, start, l] of [[-0.035, 0.03, 0.07], [0, 0.05, 0.08], [0.035, 0.035, 0.06]]) {
      ctx.beginPath();
      ctx.moveTo(len / 2 + start * S, off * S);
      ctx.lineTo(len / 2 + (start + l) * S, off * S);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.085, 0, Math.PI * 2);
  ctx.fillStyle = CONFIG.colors.player;
  ctx.fill();
  ctx.lineWidth = S * 0.018;
  ctx.stroke();
  await save(out, 'cover.png');
}

/**
 * The itch page banner: a strip across the top of a stage-6 arena (spike lane, cannon, missiles), rendered by the
 * game at ~1.5 px per world unit and cropped, with the title over it. 960 CSS px wide, the itch page width.
 */
async function banner() {
  const W = 960;
  const H = 250;
  const s = stage(W, 560);
  const w = s.world;
  // Just before the cannons appear (the sim derives elapsed from time), so no cannon pokes into the card's corner.
  w.elapsed = 96;
  w.time = 2.75 + 96;
  w.stage = 6;
  w.cannonClock = 0.3;
  for (let x = -319; x < 318; x += 21) w.arrows.push({ x, y: 156, px: x, dir: 1, tip: -1 });
  for (let x = 309; x > -318; x -= 21) w.arrows.push({ x, y: -156, px: x, dir: -1, tip: 1 });
  const p = w.player;
  p.x = p.px = 215;
  p.y = p.py = 70;
  fly(w, 0, -300, 22, 0.1);
  fly(w, 1, -170, 105, -0.25);
  fly(w, 2, 70, 125, -0.5);
  fly(w, 5, -250, 30, 0.1);
  fly(w, 6, 40, 20, 0.25);
  settle(s, 0.12);
  // A closed "game window" card: the inside of the arena (from just under its top wall) in a rounded, outlined frame.
  const v = s.renderer.view();
  // Side margins match the game's 46 px frame at itch's 1024 px column (960 design px here, shown at 1024);
  // top and bottom stay slim so the card sits close to the game below it.
  const mx = 43;
  const my = 12;
  const r = 18;
  const lw = 6;
  const src = { x: v.x + 3, y: v.y + 1, w: v.w - 6, h: (H - 2 * my) * ((v.w - 6) / (W - 2 * mx)) };
  const out = document.createElement('canvas');
  out.width = W * DPR;
  out.height = H * DPR;
  out.style.width = `${W}px`;
  out.style.height = `${H}px`;
  document.body.append(out);
  const ctx = out.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = CONFIG.colors.frame;
  ctx.fillRect(0, 0, W, H);
  const card = () => {
    ctx.beginPath();
    ctx.moveTo(mx + r, my);
    ctx.arcTo(W - mx, my, W - mx, H - my, r);
    ctx.arcTo(W - mx, H - my, mx, H - my, r);
    ctx.arcTo(mx, H - my, mx, my, r);
    ctx.arcTo(mx, my, W - mx, my, r);
    ctx.closePath();
  };
  ctx.save();
  card();
  ctx.clip();
  ctx.drawImage(s.canvas, src.x * DPR, src.y * DPR, src.w * DPR, src.h * DPR, mx, my, W - 2 * mx, H - 2 * my);
  ctx.restore();
  card();
  ctx.lineWidth = lw;
  ctx.strokeStyle = CONFIG.colors.outline;
  ctx.stroke();
  outlinedText(out, 'DotDodge', W * 0.36, 124, 100);
  await save(out, 'banner.png');
}

async function main() {
  await document.fonts.load('condensed 900 104px Tektur');
  const only = new URLSearchParams(location.search).get('only');
  if (only !== 'banner') await cover();
  if (only !== 'cover') await banner();
  log('done');
}
void main();
