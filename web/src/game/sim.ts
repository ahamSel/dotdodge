import { CONFIG } from './config';
import { arrowHits, createCannons, fireCannons, moveArrows } from './hazards';
import { createMissiles, gapToPlayer, updateMissiles } from './missile';
import { createPlayer, updatePlayer } from './player';
import { countdownShown, elapsedAt, INTRO, stageAt } from './schedule';
import { createSlowMo, setSlowMo, timeScale, toggleSlowMo, updateSlowMo } from './slowmo';
import type { SimEvent, StepInput, Vec, World } from './types';

const ZERO: Vec = { x: 0, y: 0 };

export function createWorld(): World {
  return {
    time: 0,
    elapsed: 0,
    phase: 'intro',
    stage: 1,
    shown: CONFIG.countdown,
    player: createPlayer(),
    missiles: createMissiles(),
    arrows: [],
    cannons: createCannons(),
    cannonClock: 0,
    slowmo: createSlowMo(),
    events: [],
  };
}

export function drainEvents(world: World): SimEvent[] {
  const events = world.events;
  world.events = [];
  return events;
}

/** Advances the world by `dt` real seconds. Slow-mo scales everything but its own meter. */
export function step(world: World, input: StepInput, dt: number): void {
  if (input.slowmo) toggleSlowMo(world.slowmo, world.phase === 'running' && world.stage >= 6, world.events);
  if (world.phase === 'won') {
    freeze(world);
    return;
  }
  updateSlowMo(world.slowmo, dt, world.events);
  const wdt = dt * timeScale(world.slowmo);
  world.time += wdt;
  const live = world.phase === 'intro' || world.phase === 'running';
  if (live) {
    advanceClock(world);
    // The win is decided the moment the countdown reaches 0, before anything else moves this step.
    if (world.phase === 'running' && world.elapsed >= CONFIG.countdown) {
      win(world);
      freeze(world);
      return;
    }
    runSchedule(world);
  }
  const p = world.player;
  const thrust = world.slowmo.active ? CONFIG.player.slowmoThrust : CONFIG.player.thrust;
  updatePlayer(p, live ? input.move : ZERO, thrust, wdt, world.events);
  updateMissiles(world.missiles, p, wdt);
  if (live && world.elapsed >= CONFIG.cannon.startAt) fireCannons(world, wdt);
  moveArrows(world.arrows, wdt);
  if (live) collide(world);
}

function advanceClock(world: World): void {
  if (world.phase === 'intro' && world.time >= INTRO) world.phase = 'running';
  world.elapsed = Math.min(CONFIG.countdown, elapsedAt(world.time));
  const stage = stageAt(world.elapsed);
  if (stage !== world.stage) {
    world.stage = stage;
    world.events.push({ type: 'stage', stage });
  }
  const shown = countdownShown(world.elapsed);
  if (shown !== world.shown) {
    if (shown >= 1 && shown <= 10) world.events.push({ type: 'tick', remaining: shown });
    world.shown = shown;
  }
}

function runSchedule(world: World): void {
  const blinks = CONFIG.missile.blinks;
  for (const m of world.missiles) {
    if (m.state === 'idle' && world.time >= m.warnAt) {
      m.state = 'warning';
      world.events.push({ type: 'warn', id: m.id, x: m.warnX, y: m.warnY });
    }
    if (m.state !== 'warning') continue;
    const t = world.time - m.warnAt;
    while (m.blinks < blinks.length && t >= blinks[m.blinks]) {
      m.blinks++;
      world.events.push({ type: 'blink', id: m.id, x: m.warnX, y: m.warnY, n: m.blinks });
    }
    if (world.time >= m.launchAt) {
      m.state = 'flying';
      m.x = m.px = m.spawnX;
      m.y = m.py = m.spawnY;
      m.angle = m.pangle = Math.atan2(-m.spawnY, -m.spawnX);
      world.events.push({ type: 'launch', id: m.id, x: m.warnX, y: m.warnY });
    }
  }
}

function collide(world: World): void {
  if (world.ghost) return;
  const p = world.player;
  const { nearMiss, nearMissRearm } = CONFIG.missile;
  for (const m of world.missiles) {
    if (m.state !== 'flying') continue;
    const gap = gapToPlayer(m, p);
    if (gap <= 0) {
      die(world, 'missile', m.x, m.y);
      return;
    }
    // A near miss is announced as the missile starts pulling away, so it never fires right before a hit.
    if (m.nearArmed && gap < nearMiss && gap > m.lastGap) {
      m.nearArmed = false;
      world.events.push({ type: 'nearMiss', id: m.id, x: m.x, y: m.y, angle: m.angle });
    }
    if (gap > nearMissRearm) m.nearArmed = true;
    m.lastGap = gap;
  }
  for (const a of world.arrows) {
    if (arrowHits(a, p)) {
      die(world, 'arrow', a.x, a.y);
      return;
    }
  }
}

function die(world: World, by: 'missile' | 'arrow', hx: number, hy: number): void {
  world.phase = 'dead';
  const p = world.player;
  p.alive = false;
  p.vx = p.vy = 0;
  for (const m of world.missiles) if (m.state === 'flying') m.state = 'coasting';
  setSlowMo(world.slowmo, false, world.events);
  world.events.push({ type: 'death', x: p.x, y: p.y, by, hx, hy });
}

function win(world: World): void {
  world.phase = 'won';
  world.elapsed = CONFIG.countdown;
  setSlowMo(world.slowmo, false, world.events);
  world.events.push({ type: 'win', x: world.player.x, y: world.player.y });
}

/** A won world holds perfectly still (interpolation included). */
function freeze(world: World): void {
  const p = world.player;
  p.px = p.x;
  p.py = p.y;
  for (const m of world.missiles) {
    m.px = m.x;
    m.py = m.y;
    m.pangle = m.angle;
  }
  for (const a of world.arrows) a.px = a.x;
}
