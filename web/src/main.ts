import './ui/styles.css';
import { createAudioEngine } from './audio/engine';
import { soundForEvent } from './audio/events';
import { createMusic } from './audio/music';
import { createSfx } from './audio/sfx';
import { createBestTracker } from './best';
import { CONFIG } from './game/config';
import { createWorld, drainEvents, step } from './game/sim';
import type { SimEvent, StepInput, Vec, World } from './game/types';
import { createKeyboard } from './input/keyboard';
import { actionAllowed, canPause, shortcutFor } from './input/shortcuts';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx, DEATH_FLASH } from './render/fx';
import { createRenderer } from './render/renderer';
import { screenDirToWorld } from './render/view';
import { readBool, readNumber, writeBool, writeNumber } from './storage';
import { createUI, type ScreenName, type UIAction } from './ui/screens';

const ZERO: Vec = { x: 0, y: 0 };
/** A catch freezes the world for a moment so it lands with weight (the dot flashes meanwhile). */
const HIT_STOP = DEATH_FLASH;
/** Seconds of confetti before the iris closes into Congrats. */
const WIN_TO_CONGRATS = 1.6;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = createUI(document.getElementById('ui')!);
const renderer = createRenderer(canvas);
const fx = createFx(matchMedia('(prefers-reduced-motion: reduce)').matches);
// The Options sliders use the arrow keys; everywhere else they must not scroll the itch page.
const keyboard = createKeyboard(window, () => screen !== 'options');
const joystick = createJoystick(canvas);
const audio = createAudioEngine();
const sfx = createSfx(audio);
const music = createMusic(audio);

let screen: ScreenName = 'title';
let optionsFrom: ScreenName = 'title';
let world: World | null = null;
let acc = 0;
let alpha = 0;
let last = performance.now();
let hitStop = 0;
let gameOverIn = -1;
let congratsIn = -1;
let slowmoPressed = false;
let touchUsed = matchMedia('(pointer: coarse)').matches;
const best = createBestTracker(readNumber('best', 0), (v) => writeNumber('best', v));
let musicVol = readNumber('music', 60) / 100;
let sfxVol = readNumber('sfx', 80) / 100;
let muted = readBool('muted', false);

// Dev-only watch mode: open with ?watch=75 and every run starts 75 s in with a dot nothing can catch.
const watchFrom = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('watch') ?? NaN) : NaN;

if (import.meta.env.DEV) {
  (window as unknown as { dd: unknown }).dd = {
    world: () => world,
    skip: (seconds: number) => {
      if (world) world.time += seconds;
    },
  };
}

function setScreen(next: ScreenName) {
  screen = next;
  ui.show(next);
  joystick.setEnabled(next === 'playing');
  music.setDucked(next === 'paused' || next === 'options');
}

/** Saves the current run's progress if it is a new best (death, win, quit, page hide). */
function recordRun() {
  if (world && !world.ghost) best.record(world.elapsed);
}

function newRun() {
  recordRun();
  world = createWorld();
  if (watchFrom >= 0) {
    world.ghost = true;
    world.time += watchFrom;
  }
  best.startRun();
  acc = 0;
  hitStop = 0;
  gameOverIn = -1;
  congratsIn = -1;
  slowmoPressed = false;
  fx.reset();
  music.setSlow(false);
  music.setStage(1);
  music.start();
  setScreen('playing');
  ui.banner('Stage 1');
}

function startGame(fast: boolean) {
  ui.iris(newRun, fast);
}

function toMenu() {
  ui.iris(() => {
    recordRun();
    world = null;
    fx.reset();
    music.setSlow(false);
    music.setStage(1);
    music.start();
    ui.setBest(best.value);
    setScreen('title');
  }, true);
}

function pause() {
  if (canPause(screen, world?.phase ?? null)) setScreen('paused');
}

function resume() {
  if (screen === 'paused') setScreen('playing');
}

function openOptions() {
  optionsFrom = screen;
  setScreen('options');
}

function closeOptions() {
  setScreen(optionsFrom);
}

function showGameOver() {
  if (!world) return;
  ui.gameOver(world.elapsed, best.value, best.isNewBest(world.elapsed));
  setScreen('gameover');
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  writeBool('muted', muted);
}

function act(action: UIAction) {
  audio.unlock();
  if (!actionAllowed(action, screen)) return;
  if (action !== 'slowmo') sfx.play('click');
  switch (action) {
    case 'play':
      startGame(false);
      break;
    case 'restart':
      startGame(true);
      break;
    case 'options':
      openOptions();
      break;
    case 'back':
      closeOptions();
      break;
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'menu':
      toMenu();
      break;
    case 'slowmo':
      slowmoPressed = true;
      break;
    case 'toggleMute':
      toggleMute();
      break;
  }
}

function handleEvents(events: SimEvent[]) {
  if (!world || events.length === 0) return;
  fx.handle(events, world);
  renderer.onEvents(events, world);
  for (const e of events) {
    const sound = soundForEvent(e);
    if (sound) sfx.play(sound[0], sound[1]);
    switch (e.type) {
      case 'stage':
        ui.banner(`Stage ${e.stage}`);
        ui.pulseTimer();
        music.setStage(e.stage);
        break;
      case 'tick':
        ui.pulseTimer();
        break;
      case 'slowmo':
        music.setSlow(e.on);
        break;
      case 'death':
        hitStop = HIT_STOP;
        gameOverIn = CONFIG.retryDelay;
        music.stop();
        recordRun();
        break;
      case 'win':
        congratsIn = WIN_TO_CONGRATS;
        music.stop();
        recordRun();
        break;
    }
  }
}

function currentInput(): StepInput {
  if (screen !== 'playing') return { move: ZERO, slowmo: false };
  const kb = keyboard.dir();
  const d = kb.x !== 0 || kb.y !== 0 ? kb : joystick.dir();
  return { move: screenDirToWorld(renderer.view(), d.x, d.y), slowmo: slowmoPressed };
}

function frame(now: number) {
  // Schedule first, so one bad frame can't stop the game for good.
  requestAnimationFrame(frame);
  // rAF timestamps can be slightly earlier than a performance.now() read, so never go negative.
  const frameDt = Math.min(Math.max(0, (now - last) / 1000), CONFIG.maxFrame);
  last = now;
  // The world keeps moving behind the game-over screen (missiles coasting away); paused and options freeze it.
  const running = screen === 'playing' || screen === 'gameover' || screen === 'congrats';
  if (world && running) {
    if (hitStop > 0) {
      hitStop -= frameDt; // the world holds still; effects keep animating
    } else {
      const input = currentInput();
      const plan = planSteps(acc, frameDt, CONFIG.step, CONFIG.maxFrame);
      for (let i = 0; i < plan.steps; i++) step(world, i === 0 ? input : { move: input.move, slowmo: false }, CONFIG.step);
      if (plan.steps > 0) slowmoPressed = false;
      acc = plan.acc;
      alpha = plan.alpha;
    }
    handleEvents(drainEvents(world));
    if (gameOverIn > 0) {
      gameOverIn -= frameDt;
      if (gameOverIn <= 0) showGameOver();
    }
    if (congratsIn > 0) {
      congratsIn -= frameDt;
      if (congratsIn <= 0) ui.iris(() => setScreen('congrats'));
    }
  }
  // Re-fit when the canvas size changed without a resize event (iOS rotation, itch fullscreen).
  const v = renderer.view();
  if (Math.max(1, canvas.clientWidth) !== v.cssW || Math.max(1, canvas.clientHeight) !== v.cssH) ui.layout(renderer.resize());
  const animate = running || screen === 'title';
  if (animate) fx.update(frameDt);
  if (world) ui.hud(world, touchUsed);
  renderer.draw(world, fx, alpha, screen === 'playing' ? joystick.view() : null, animate ? frameDt : 0);
}

ui.onAction(act);
ui.onHover(() => sfx.play('hover'));
ui.onVolume((kind, value) => {
  if (kind === 'music') musicVol = value;
  else sfxVol = value;
  audio.setVolumes(musicVol, sfxVol);
  writeNumber(kind, Math.round(value * 100));
});
audio.onUnlock(() => {
  if (screen !== 'gameover' && screen !== 'congrats') music.start();
});

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const onButton = !!(e.target as Element | null)?.closest?.('button');
  const { action, preventDefault } = shortcutFor(
    { code: e.code, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, onButton },
    screen,
  );
  if (preventDefault) e.preventDefault();
  switch (action) {
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'back':
      closeOptions();
      break;
    case 'start':
      startGame(screen !== 'title');
      break;
    case 'restart':
      startGame(true);
      break;
    case 'mute':
      toggleMute();
      break;
    case 'slowmo':
      slowmoPressed = true;
      break;
  }
});
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') touchUsed = true;
});
window.addEventListener('resize', () => ui.layout(renderer.resize()));
window.addEventListener('blur', pause);
window.addEventListener('pagehide', recordRun);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keyboard.clear(); // some browsers hide a tab without blurring the window
    pause();
  }
  music.setHidden(document.hidden);
});

audio.setVolumes(musicVol, sfxVol);
audio.setMuted(muted);
ui.setVolumes(musicVol, sfxVol);
ui.setMuted(muted);
ui.setBest(best.value);
ui.layout(renderer.view());
setScreen('title');
requestAnimationFrame(frame);
