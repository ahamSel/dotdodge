export interface Vec {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  /** Position at the start of the last step, for render interpolation. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export type MissileState = 'idle' | 'warning' | 'flying' | 'coasting';

export interface Missile {
  /** Index into CONFIG.missiles. */
  id: number;
  color: string;
  speed: number;
  /** Maximum turn rate in radians per second. */
  turn: number;
  state: MissileState;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Heading in radians, and the heading at the start of the last step. */
  angle: number;
  pangle: number;
  /** Where it enters from (outside the wall). */
  spawnX: number;
  spawnY: number;
  /** Where its warning chevron sits (on the wall). */
  warnX: number;
  warnY: number;
  /** World times its warning starts and it launches. */
  warnAt: number;
  launchAt: number;
  /** Warning blinks already announced. */
  blinks: number;
  /** True once fully inside the arena; from then on it is kept inside. */
  entered: boolean;
  /** A near miss can fire (re-armed once the missile is far away again). */
  nearArmed: boolean;
  /** Gap to the player on the last step. */
  lastGap: number;
}

export interface Arrow {
  x: number;
  y: number;
  px: number;
  /** Travel direction along x. */
  dir: 1 | -1;
  /** Tip points down (-1, top lane) or up (+1, bottom lane). */
  tip: 1 | -1;
}

export interface Cannon {
  x: number;
  y: number;
  dir: 1 | -1;
  tip: 1 | -1;
}

export interface SlowMo {
  active: boolean;
  /** Real seconds of slow-mo left. */
  meter: number;
}

export type Phase = 'intro' | 'running' | 'dead' | 'won';

export type SimEvent =
  | { type: 'warn'; id: number; x: number; y: number }
  | { type: 'blink'; id: number; x: number; y: number; n: number }
  | { type: 'launch'; id: number; x: number; y: number }
  | { type: 'stage'; stage: number }
  | { type: 'bounce'; x: number; y: number; nx: number; ny: number; speed: number }
  | { type: 'nearMiss'; id: number; x: number; y: number; angle: number }
  | { type: 'fire'; x: number; y: number; dir: 1 | -1 }
  | { type: 'slowmo'; on: boolean }
  | { type: 'tick'; remaining: number }
  | { type: 'death'; x: number; y: number; by: 'missile' | 'arrow'; hx: number; hy: number }
  | { type: 'win'; x: number; y: number };

export interface World {
  /** World seconds since the run started (slowed by slow-mo). */
  time: number;
  /** Countdown seconds elapsed; frozen after death or a win. */
  elapsed: number;
  phase: Phase;
  stage: number;
  /** Last countdown number shown, for the final-ten ticks. */
  shown: number;
  player: Player;
  missiles: Missile[];
  arrows: Arrow[];
  cannons: Cannon[];
  /** World seconds until the cannons fire again. */
  cannonClock: number;
  slowmo: SlowMo;
  events: SimEvent[];
  /** Dev-only watch mode: nothing can catch the dot. */
  ghost?: boolean;
}

export interface StepInput {
  /** Thrust direction in world space, length ≤ 1. */
  move: Vec;
  /** The slow-mo toggle was pressed since the last step. */
  slowmo: boolean;
}
