import { CONFIG } from '../src/game/config';
import { countdownShown, INTRO, stageAt } from '../src/game/schedule';
import { createWorld, drainEvents, step } from '../src/game/sim';
import type { SimEvent, StepInput, World } from '../src/game/types';

export const IDLE: StepInput = { move: { x: 0, y: 0 }, slowmo: false };

/** Steps the world for `seconds` of real time and returns every event. */
export function run(world: World, seconds: number, input: StepInput = IDLE): SimEvent[] {
  const events: SimEvent[] = [];
  const n = Math.round(seconds / CONFIG.step);
  for (let i = 0; i < n; i++) {
    step(world, input, CONFIG.step);
    events.push(...drainEvents(world));
  }
  return events;
}

/** No missile will ever warn or launch on its own. */
export function quiet(world: World): World {
  for (const m of world.missiles) m.warnAt = m.launchAt = Infinity;
  return world;
}

/** A quiet world, already `elapsed` seconds into the countdown. */
export function runningWorld(elapsed: number): World {
  const w = quiet(createWorld());
  w.time = INTRO + elapsed;
  w.elapsed = elapsed;
  w.phase = 'running';
  w.stage = stageAt(elapsed);
  w.shown = countdownShown(elapsed);
  return w;
}

export function launch(world: World, id: number, x: number, y: number, angle: number) {
  const m = world.missiles[id];
  Object.assign(m, { state: 'flying', x, y, px: x, py: y, angle, pangle: angle });
  return m;
}
