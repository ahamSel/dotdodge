// Stages a cover with the real sim + renderer and saves it as a PNG (see tools/vite.config.ts).
import '../src/ui/styles.css'; // loads the Tektur @font-face
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, step } from '../src/game/sim';
import type { World } from '../src/game/types';
import { createFx } from '../src/render/fx';
import { createRenderer } from '../src/render/renderer';

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
 * The cover is a real frame from the game, zoomed in: the scene is rendered on a large canvas
 * (≈1.8 px per world unit) and its top-left corner is cropped, so the frame and walls still show
 * and the dot and missiles stay readable at itch's thumbnail size.
 */
async function cover() {
  const W = 630;
  const H = 500;
  const s = stage(1150, 660);
  const p = s.world.player;
  p.x = p.px = -120;
  p.y = p.py = 10;
  fly(s.world, 0, -300, 0, 0);
  fly(s.world, 1, -170, 112, -1.0);
  fly(s.world, 2, 10, 60, Math.PI + 0.3);
  fly(s.world, 3, -20, -75, 2.4);
  fly(s.world, 5, -300, 100, -0.35);
  settle(s, 0.12);
  const out = document.createElement('canvas');
  out.width = W * DPR;
  out.height = H * DPR;
  out.style.width = `${W}px`;
  out.style.height = `${H}px`;
  out.getContext('2d')!.drawImage(s.canvas, 0, 0, W * DPR, H * DPR, 0, 0, W * DPR, H * DPR);
  document.body.append(out);
  outlinedText(out, 'DotDodge', W / 2 + 40, 78, 104);
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
  w.elapsed = 96; // just before the cannons appear, so no cannon pokes into the card's corner
  w.time = 2.75 + 104;
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
  const m = 12; // red margin around the card
  const r = 18;
  const lw = 6;
  const src = { x: v.x + 3, y: v.y + 1, w: v.w - 6, h: (H - 2 * m) * ((v.w - 6) / (W - 2 * m)) };
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
    ctx.moveTo(m + r, m);
    ctx.arcTo(W - m, m, W - m, H - m, r);
    ctx.arcTo(W - m, H - m, m, H - m, r);
    ctx.arcTo(m, H - m, m, m, r);
    ctx.arcTo(m, m, W - m, m, r);
    ctx.closePath();
  };
  ctx.save();
  card();
  ctx.clip();
  ctx.drawImage(s.canvas, src.x * DPR, src.y * DPR, src.w * DPR, src.h * DPR, m, m, W - 2 * m, H - 2 * m);
  ctx.restore();
  card();
  ctx.lineWidth = lw;
  ctx.strokeStyle = CONFIG.colors.outline;
  ctx.stroke();
  outlinedText(out, 'DotDodge', W * 0.34, 124, 104);
  await save(out, 'banner.png');
}

async function main() {
  await document.fonts.load('condensed 900 104px Tektur');
  if (!location.search.includes('only=banner')) await cover();
  await banner();
  log('done');
}
void main();
