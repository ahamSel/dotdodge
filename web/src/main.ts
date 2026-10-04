import { CONFIG } from './game/config';
import { createWorld, drainEvents, step } from './game/sim';
import { createKeyboard } from './input/keyboard';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';
import { screenDirToWorld } from './render/view';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = createRenderer(canvas);
const fx = createFx(false);
const keyboard = createKeyboard(window);
let world = createWorld();
let acc = 0;
let alpha = 0;
let last = performance.now();
let slowmo = false;

(window as unknown as { dd: unknown }).dd = { world: () => world, skip: (s: number) => (world.time += s) };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') world = createWorld();
  if (e.code === 'KeyX') slowmo = true;
});
window.addEventListener('resize', () => renderer.resize());

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(0, (now - last) / 1000), CONFIG.maxFrame);
  last = now;
  const plan = planSteps(acc, dt, CONFIG.step, CONFIG.maxFrame);
  const d = keyboard.dir();
  const move = screenDirToWorld(renderer.view(), d.x, d.y);
  for (let i = 0; i < plan.steps; i++) step(world, { move, slowmo: slowmo && i === 0 }, CONFIG.step);
  if (plan.steps > 0) slowmo = false;
  acc = plan.acc;
  alpha = plan.alpha;
  const events = drainEvents(world);
  fx.handle(events, world);
  renderer.onEvents(events, world);
  fx.update(dt);
  renderer.draw(world, fx, alpha, null, dt);
}
requestAnimationFrame(frame);
