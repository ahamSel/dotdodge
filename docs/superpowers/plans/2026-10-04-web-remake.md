# DotDodge Web Remake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 2020 Unity game DotDodge as a polished TypeScript + Canvas 2D browser game in `web/`, shippable as an itch.io HTML5 zip.

**Architecture:** A pure, DOM-free simulation (`src/game/`) steps a `World` at a fixed 60 Hz in the original Unity units and emits typed events. A view module fits the fixed 624×320 arena to the screen (rotated in portrait). The renderer, effects, synthesised audio and a DOM overlay UI consume world state and events. `main.ts` owns the loop and a small screen state machine. The structure follows `~/projects/dev/gwa/web` (Game Without Art).

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5, Canvas 2D, WebAudio. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-web-remake-design.md`

## Global Constraints

- All web code lives in `web/`. Do not modify anything under `Assets/`, `Packages/`, `ProjectSettings/` or `UserSettings/`.
- No runtime dependencies. Dev dependencies only: `typescript@^7.0.2`, `vite@^8.3.2`, `vitest@^5.0.3`.
- No asset from `Assets/` ships (font, music, SFX). The font is Tektur (OFL), bundled with `OFL.txt`. All sound is synthesised. All art is canvas shapes, CSS or inline SVG.
- World: original Unity units. Arena half-size `HW = 312`, `HH = 160`, origin at the centre, +y up. Fixed step 1/60 s. Frame delta clamped to ≥ 0 and capped at 0.25 s.
- Player: radius 9.6, thrust 1400 u/s² (3000 in slow-mo), drag 0.5 (Box2D damping), bounce `max(0.55·|vₙ|, 180)`, bounce event only when `|vₙ| > 40`.
- Missiles: capsule length 16, radius 3.5. Warning 2.75 s with blinks at 0.67/1.33/2.0 s (0.33 s each). Enter margin 8, separation 14, near miss < 14, re-arm > 60. Table values exactly as in the spec.
- Countdown 120 s, starting when missile 0 launches (world time 2.75). Stages at elapsed 17, 37, 57, 80, 97.
- Cannons from elapsed 97: every 0.3 s, arrows 70 u/s, 12 wide × 10.7 tall, lanes `y = ±156`, cannons at `x = ∓319`.
- Slow-mo: unlocks at stage 6, scale 0.1, meter 5 s real, refill 0.5/s, minimum 0.25 to start.
- Colours: frame `#ff0000`, field `#ffad00`, outline `#000000`, player `#ffffff`. Missile colours exactly as in the spec table.
- Vite `base: './'`. Persistent values go through `src/storage.ts` (prefix `dd.`), never raw `localStorage`.
- No `ctx.roundRect` call without the arcTo fallback. The next animation frame is scheduled before any game work.
- Credit line: "By ahamsel".

## Review Focus

1. **Phone rotated or window resized mid-run.** Expect the arena to re-fit and the HUD to follow it, the sim to be unaffected, and "up" on the screen to stay up after rotating. Pinned by the `view` tests in Task 7 (both orientations, input rotation, matrix ↔ `toScreen` agreement).
2. **Tab hidden, alt-tab or a long stall mid-run.** Expect no time jump, auto-pause, keys released, and a slow-mo meter that doesn't drain while paused. Pinned by `loop.test.ts` (Task 1), the keyboard blur test (Task 7), and the Task 6 test that the meter only changes when `step` runs. Auto-pause is checked manually in Task 11.
3. **X pressed before stage 6, after death or rapidly.** Expect nothing before stage 6, a clean on/off, and no slow-mo after death. Pinned by the Task 5 slow-mo tests and the Task 6 "toggle ignored before stage 6 and when dead" test.
4. **`localStorage` blocked** (Safari private mode, sandboxed itch iframe). Expect the game to work normally; best and volumes just aren't kept. Pinned by `storage.test.ts` (Task 1).
5. **A missile touching the player on the step the timer hits 0, or after the win.** Expect the win to stand and the frozen world to never kill the player. Pinned by the Task 6 "after the win nothing can kill you" test.

---

## File Map

| File | Responsibility |
|---|---|
| `web/package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore` | Tooling |
| `web/src/game/config.ts` | Every tuning number and colour |
| `web/src/game/rng.ts` | Seedable RNG (store-art tool) |
| `web/src/game/types.ts` | World, Player, Missile, Arrow, Cannon, SlowMo, SimEvent, StepInput |
| `web/src/game/arena.ts` | `HW`, `HH`, `clamp`, `wallPoint` |
| `web/src/game/collide.ts` | Segment distance, circle–capsule gap, circle–triangle, arrow corners |
| `web/src/game/schedule.ts` | Intro, elapsed, stages, countdown display, warning/launch times, blink lighting, time format |
| `web/src/game/player.ts` | Thrust, drag, wall bounce |
| `web/src/game/missile.ts` | Create, steer (homing), keep inside, separate, coast, gap to player |
| `web/src/game/hazards.ts` | Cannons, arrows, arrow hits |
| `web/src/game/slowmo.ts` | Meter, toggle, time scale |
| `web/src/game/sim.ts` | `createWorld`, `step`, `drainEvents`, schedule, death, win, near miss |
| `web/src/loop.ts` | Fixed-step planner |
| `web/src/storage.ts` | Safe localStorage |
| `web/src/best.ts` | Best record tracker and run description |
| `web/src/render/view.ts` | Arena fit, portrait rotation, transforms |
| `web/src/render/tween.ts`, `shapes.ts`, `trails.ts`, `motion.ts` | Helpers: easing/colour, paths, tapered trails, dot squash spring |
| `web/src/render/fx.ts` | Particles, shards, confetti, rings, streaks, shake, flash, pulse |
| `web/src/render/renderer.ts` | Canvas drawing |
| `web/src/input/keyboard.ts`, `shortcuts.ts`, `touch.ts` | Keyboard, shortcuts, thrust joystick |
| `web/src/ui/screens.ts`, `styles.css`, `fonts/tektur.woff2`, `web/index.html` | DOM screens, HUD, logo, iris |
| `web/public/OFL-Tektur.txt` | Font licence (shipped at the zip root) |
| `web/src/audio/engine.ts`, `sfx.ts`, `music.ts`, `events.ts` | Audio context and buses, effects, music, event → sound |
| `web/src/main.ts` | Boot, loop, state machine |
| `web/scripts/zip-itch.mjs` | itch zip |
| `web/tools/*` | Store-art generator |
| `web/tests/*.test.ts` | Unit tests |

All commands run from `web/` unless stated otherwise.

---

### Task 1: Scaffold, config, RNG, storage, loop

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/.gitignore`
- Create: `web/src/game/config.ts`, `web/src/game/rng.ts`, `web/src/storage.ts`, `web/src/loop.ts`
- Test: `web/tests/rng.test.ts`, `web/tests/storage.test.ts`, `web/tests/loop.test.ts`

**Interfaces:**
- Produces: `CONFIG` (as below), `createRng(seed?): Rng`, `readNumber/writeNumber/readBool/writeBool(key, …)` (keys stored as `dd.<key>`), `planSteps(acc, frameDt, step, maxFrame): { steps, acc, alpha }`.

- [ ] **Step 1: Scaffold the project**

`web/package.json`:
```json
{
  "name": "dotdodge",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "itch": "npm run build && node scripts/zip-itch.mjs"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vite": "^8.3.2",
    "vitest": "^5.0.3"
  }
}
```

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
```

`web/.gitignore`:
```
node_modules/
dist/
*.zip
```

Run: `cd web && npm install`
Expected: installs three dev dependencies, no errors.

- [ ] **Step 2: Write `config.ts`** (no test of its own; every later test exercises it)

```ts
/** Every tuning number and colour. World units are the original Unity units (arena 624 × 320). */
export const CONFIG = {
  step: 1 / 60,
  maxFrame: 0.25,
  arena: { hw: 312, hh: 160, corner: 12 },
  /** Outline width in world units (never thinner than 2 CSS px on screen). */
  outline: 2.4,
  countdown: 120,
  /** Countdown-elapsed seconds at which stages 2..6 begin. */
  stages: [17, 37, 57, 80, 97],
  player: {
    radius: 9.6,
    thrust: 1400,
    slowmoThrust: 3000,
    drag: 0.5,
    restitution: 0.55,
    minBounce: 180,
    bounceEventSpeed: 40,
  },
  missile: {
    length: 16,
    radius: 3.5,
    /** Warning length; also the intro (the countdown starts when missile 0 launches). */
    warnTime: 2.75,
    blinks: [0.67, 1.33, 2.0],
    blinkLength: 0.33,
    enterMargin: 8,
    separation: 14,
    nearMiss: 14,
    nearMissRearm: 60,
  },
  /** warnAt: countdown-elapsed seconds when the warning starts (missile 0 warns at world time 0). */
  missiles: [
    { color: '#ffffff', speed: 300, turn: 470, x: -336, y: 0, warnAt: -2.75 },
    { color: '#ec1c24', speed: 400, turn: 550, x: 0, y: 179, warnAt: 17 },
    { color: '#0ed145', speed: 450, turn: 600, x: 336, y: 0, warnAt: 37 },
    { color: '#00a8f3', speed: 500, turn: 640, x: 0, y: -182, warnAt: 57 },
    { color: '#b83dba', speed: 600, turn: 765, x: 331, y: -177, warnAt: 80 },
    { color: '#ffd900', speed: 650, turn: 800, x: -331, y: 174, warnAt: 80 },
    { color: '#ff7f27', speed: 700, turn: 830, x: 332, y: 180, warnAt: 97 },
  ],
  cannon: { startAt: 97, interval: 0.3, arrowSpeed: 70, arrowW: 12, arrowH: 10.7, laneY: 156, x: 319 },
  slowmo: { scale: 0.1, capacity: 5, refill: 0.5, minStart: 0.25 },
  retryDelay: 1.2,
  colors: { frame: '#ff0000', field: '#ffad00', outline: '#000000', player: '#ffffff' },
} as const;
```

- [ ] **Step 3: Write the failing tests for RNG, storage and loop**

`web/tests/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) expect(a.next()).toBe(b.next());
  });

  it('keeps range() inside [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.range(-3, 5);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThan(5);
    }
  });
});
```

`web/tests/storage.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBool, readNumber, writeBool, writeNumber } from '../src/storage';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('round-trips numbers and booleans under the dd. prefix', () => {
    const s = fakeStorage();
    vi.stubGlobal('localStorage', s);
    writeNumber('best', 42);
    expect(readNumber('best', 0)).toBe(42);
    expect(s.getItem('dd.best')).toBe('42');
    writeBool('muted', true);
    expect(readBool('muted', false)).toBe(true);
  });

  it('falls back on garbage values', () => {
    const s = fakeStorage();
    s.setItem('dd.best', 'abc');
    vi.stubGlobal('localStorage', s);
    expect(readNumber('best', 7)).toBe(7);
  });

  it('survives storage that throws (private mode)', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    });
    expect(readNumber('best', 3)).toBe(3);
    expect(() => writeNumber('best', 5)).not.toThrow();
  });

  it('survives a localStorage getter that throws (sandboxed iframe)', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(readNumber('best', 9)).toBe(9);
      expect(() => writeBool('muted', true)).not.toThrow();
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
```

`web/tests/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planSteps } from '../src/loop';

const STEP = 1 / 60;

describe('planSteps', () => {
  it('runs one step per 1/60 s frame', () => {
    const p = planSteps(0, STEP, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0, 9);
  });

  it('carries leftover time into the next frame', () => {
    const p = planSteps(0, 0.025, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0.025 - STEP, 9);
    expect(p.alpha).toBeCloseTo((0.025 - STEP) / STEP, 6);
  });

  it('caps a long stall instead of spiralling', () => {
    expect(planSteps(0, 10, STEP, 0.25).steps).toBe(15);
  });

  it('ignores negative deltas', () => {
    expect(planSteps(0, -1, STEP, 0.25).steps).toBe(0);
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run`
Expected: FAIL (modules `../src/game/rng`, `../src/storage`, `../src/loop` not found).

- [ ] **Step 5: Implement**

`web/src/game/rng.ts`:
```ts
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  angle(): number;
}

/** mulberry32: tiny, fast, and seedable so generated art is repeatable. */
export function createRng(seed = Date.now()): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    angle: () => next() * Math.PI * 2,
  };
}
```

`web/src/storage.ts`:
```ts
const PREFIX = 'dd.';

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Storage is blocked (private mode, sandboxed iframe): the game works, the value just isn't kept.
  }
}

export function readNumber(key: string, fallback: number): number {
  const raw = read(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function writeNumber(key: string, value: number): void {
  write(key, String(value));
}

export function readBool(key: string, fallback: boolean): boolean {
  const raw = read(key);
  return raw === '1' ? true : raw === '0' ? false : fallback;
}

export function writeBool(key: string, value: boolean): void {
  write(key, value ? '1' : '0');
}
```

`web/src/loop.ts`:
```ts
export interface StepPlan {
  steps: number;
  acc: number;
  /** How far between the last two sim states to draw, for interpolation. */
  alpha: number;
}

/** Splits a frame's delta into fixed steps. A stalled frame is capped so the sim never spirals. */
export function planSteps(acc: number, frameDt: number, step: number, maxFrame: number): StepPlan {
  let a = acc + Math.min(Math.max(frameDt, 0), maxFrame);
  const steps = Math.floor(a / step + 1e-9);
  a = Math.max(0, a - steps * step);
  return { steps, acc: a, alpha: Math.min(1, a / step) };
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (3 files), no type errors.

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json web/vite.config.ts web/.gitignore web/src web/tests
git commit -m "web: scaffold Vite + TS project with config, RNG, safe storage and step planner"
```

---

### Task 2: Types, arena, collision, schedule

**Files:**
- Create: `web/src/game/types.ts`, `web/src/game/arena.ts`, `web/src/game/collide.ts`, `web/src/game/schedule.ts`
- Test: `web/tests/collide.test.ts`, `web/tests/schedule.test.ts`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - types: `Vec`, `Player`, `MissileState`, `Missile`, `Arrow`, `Cannon`, `SlowMo`, `Phase`, `SimEvent`, `World`, `StepInput` (exact shapes below)
  - arena: `HW`, `HH`, `clamp(v, lo, hi)`, `wallPoint(x, y): Vec`
  - collide: `segmentDistance(px, py, ax, ay, bx, by)`, `circleCapsuleGap(cx, cy, cr, x, y, angle, length, radius)`, `circleTriangle(cx, cy, r, ax, ay, bx, by, qx, qy)`, `arrowCorners(x, y, tip, w, h): [Vec, Vec, Vec]`
  - schedule: `INTRO`, `elapsedAt(time)`, `stageAt(elapsed)`, `countdownShown(elapsed)`, `warnTimeOf(i)`, `launchTimeOf(i)`, `warningLit(t)`, `lastBlinkStart(t)`, `formatTime(seconds)`

- [ ] **Step 1: Write `types.ts`**

```ts
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
}

export interface StepInput {
  /** Thrust direction in world space, length ≤ 1. */
  move: Vec;
  /** The slow-mo toggle was pressed since the last step. */
  slowmo: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

`web/tests/collide.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { arrowCorners, circleCapsuleGap, circleTriangle, segmentDistance } from '../src/game/collide';

describe('segmentDistance', () => {
  it('measures to the nearest point, clamped to the ends', () => {
    expect(segmentDistance(0, 5, -10, 0, 10, 0)).toBeCloseTo(5);
    expect(segmentDistance(13, 4, -10, 0, 10, 0)).toBeCloseTo(5);
    expect(segmentDistance(3, 4, 0, 0, 0, 0)).toBeCloseTo(5);
  });
});

describe('circleCapsuleGap', () => {
  // Capsule 16 long, radius 3.5: its core segment runs ±4.5 along its heading.
  it('measures the gap beside the capsule', () => {
    expect(circleCapsuleGap(0, 3.5 + 9.6 + 1, 9.6, 0, 0, 0, 16, 3.5)).toBeCloseTo(1);
  });

  it('measures the gap past the rounded end, following the heading', () => {
    expect(circleCapsuleGap(8 + 9.6 + 2, 0, 9.6, 0, 0, 0, 16, 3.5)).toBeCloseTo(2);
    expect(circleCapsuleGap(0, 8 + 9.6 + 2, 9.6, 0, 0, Math.PI / 2, 16, 3.5)).toBeCloseTo(2);
  });

  it('goes negative when they overlap', () => {
    expect(circleCapsuleGap(0, 0, 9.6, 5, 0, 0, 16, 3.5)).toBeLessThan(0);
  });
});

describe('arrows', () => {
  it('puts the tip of a top-lane arrow below its base', () => {
    const [a, b, c] = arrowCorners(0, 156, -1, 12, 10.7);
    expect(a).toEqual({ x: -6, y: 156 + 5.35 });
    expect(b).toEqual({ x: 6, y: 156 + 5.35 });
    expect(c).toEqual({ x: 0, y: 156 - 5.35 });
  });

  it('hits a circle that reaches the tip, and misses one that does not', () => {
    const [a, b, c] = arrowCorners(0, 156, -1, 12, 10.7);
    const hit = (x: number, y: number) => circleTriangle(x, y, 9.6, a.x, a.y, b.x, b.y, c.x, c.y);
    expect(hit(0, 141.5)).toBe(true); // 9.15 from the tip
    expect(hit(0, 140)).toBe(false); // 10.65 from the tip
    expect(hit(20, 150)).toBe(false);
    expect(hit(0, 158)).toBe(true); // centre inside the triangle
  });
});
```

`web/tests/schedule.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  countdownShown,
  elapsedAt,
  formatTime,
  INTRO,
  lastBlinkStart,
  launchTimeOf,
  stageAt,
  warningLit,
  warnTimeOf,
} from '../src/game/schedule';

describe('schedule', () => {
  it('starts the countdown when missile 0 launches', () => {
    expect(INTRO).toBe(2.75);
    expect(elapsedAt(1)).toBe(0);
    expect(elapsedAt(INTRO + 5)).toBeCloseTo(5);
  });

  it('moves through the six stages at the 2020 thresholds', () => {
    expect(stageAt(0)).toBe(1);
    expect(stageAt(16.99)).toBe(1);
    expect(stageAt(17)).toBe(2);
    expect(stageAt(37)).toBe(3);
    expect(stageAt(57)).toBe(4);
    expect(stageAt(80)).toBe(5);
    expect(stageAt(96.99)).toBe(5);
    expect(stageAt(97)).toBe(6);
    expect(stageAt(500)).toBe(6);
  });

  it('shows the countdown rounded up, so the last second reads 1', () => {
    expect(countdownShown(0)).toBe(120);
    expect(countdownShown(0.5)).toBe(120);
    expect(countdownShown(1)).toBe(119);
    expect(countdownShown(110)).toBe(10);
    expect(countdownShown(119.5)).toBe(1);
    expect(countdownShown(120)).toBe(0);
    expect(countdownShown(130)).toBe(0);
  });

  it('warns 2.75 s before each launch, missile 0 at world time 0', () => {
    expect(warnTimeOf(0)).toBe(0);
    expect(launchTimeOf(0)).toBe(2.75);
    expect(warnTimeOf(1)).toBeCloseTo(INTRO + 17);
    expect(launchTimeOf(6)).toBeCloseTo(INTRO + 97 + 2.75);
  });

  it('lights the chevron three times', () => {
    expect(warningLit(0.5)).toBe(false);
    expect(warningLit(0.7)).toBe(true);
    expect(warningLit(1.1)).toBe(false);
    expect(warningLit(1.4)).toBe(true);
    expect(warningLit(2.1)).toBe(true);
    expect(warningLit(2.4)).toBe(false);
    expect(lastBlinkStart(1.5)).toBe(1.33);
    expect(lastBlinkStart(0.1)).toBe(-1);
  });

  it('formats seconds as m:ss', () => {
    expect(formatTime(61.9)).toBe('1:01');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(120)).toBe('2:00');
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run tests/collide.test.ts tests/schedule.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`web/src/game/arena.ts`:
```ts
import { CONFIG } from './config';
import type { Vec } from './types';

export const HW = CONFIG.arena.hw;
export const HH = CONFIG.arena.hh;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Where a point outside the arena meets the wall (the warning chevron's spot). */
export function wallPoint(x: number, y: number): Vec {
  return { x: clamp(x, -HW, HW), y: clamp(y, -HH, HH) };
}
```

`web/src/game/collide.ts`:
```ts
import type { Vec } from './types';

/** Distance from point P to segment AB. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** Gap between a circle and a capsule (centre x,y, heading angle); negative when they overlap. */
export function circleCapsuleGap(
  cx: number,
  cy: number,
  cr: number,
  x: number,
  y: number,
  angle: number,
  length: number,
  radius: number,
): number {
  const half = length / 2 - radius;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return segmentDistance(cx, cy, x - dx, y - dy, x + dx, y + dy) - radius - cr;
}

function side(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** True when a circle overlaps triangle ABQ. */
export function circleTriangle(
  cx: number,
  cy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  qx: number,
  qy: number,
): boolean {
  const d1 = side(cx, cy, ax, ay, bx, by);
  const d2 = side(cx, cy, bx, by, qx, qy);
  const d3 = side(cx, cy, qx, qy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(hasNeg && hasPos)) return true; // centre inside
  return (
    segmentDistance(cx, cy, ax, ay, bx, by) < r ||
    segmentDistance(cx, cy, bx, by, qx, qy) < r ||
    segmentDistance(cx, cy, qx, qy, ax, ay) < r
  );
}

/** The corners of a spike arrow: two base corners, then the tip. */
export function arrowCorners(x: number, y: number, tip: 1 | -1, w: number, h: number): [Vec, Vec, Vec] {
  const base = y - (tip * h) / 2;
  return [
    { x: x - w / 2, y: base },
    { x: x + w / 2, y: base },
    { x, y: y + (tip * h) / 2 },
  ];
}
```

`web/src/game/schedule.ts`:
```ts
import { CONFIG } from './config';

/** The countdown starts when missile 0 launches, one warning after the run begins. */
export const INTRO = CONFIG.missile.warnTime;

export function elapsedAt(time: number): number {
  return Math.max(0, time - INTRO);
}

export function stageAt(elapsed: number): number {
  let stage = 1;
  for (const t of CONFIG.stages) if (elapsed >= t) stage++;
  return stage;
}

/** The number the countdown shows: rounded up, so the last second reads 1 and 0 means done. */
export function countdownShown(elapsed: number): number {
  return Math.max(0, Math.ceil(CONFIG.countdown - elapsed - 1e-9));
}

export function warnTimeOf(index: number): number {
  return INTRO + CONFIG.missiles[index].warnAt;
}

export function launchTimeOf(index: number): number {
  return warnTimeOf(index) + CONFIG.missile.warnTime;
}

/** True while a warning chevron is lit, `t` seconds into its warning. */
export function warningLit(t: number): boolean {
  return CONFIG.missile.blinks.some((b) => t >= b && t < b + CONFIG.missile.blinkLength);
}

/** Start of the latest blink at or before `t`, or -1 before the first. */
export function lastBlinkStart(t: number): number {
  let start = -1;
  for (const b of CONFIG.missile.blinks) if (t >= b) start = b;
  return start;
}

export function formatTime(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/game web/tests
git commit -m "web: add world types, arena, collision helpers and the stage schedule"
```

---

### Task 3: Player physics

**Files:**
- Create: `web/src/game/player.ts`
- Test: `web/tests/player.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `HW`, `HH`, types `Player`, `SimEvent`, `Vec`.
- Produces: `createPlayer(): Player`, `updatePlayer(p, move, thrust, dt, events): void`.

- [ ] **Step 1: Write the failing test**

`web/tests/player.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { HW } from '../src/game/arena';
import { CONFIG } from '../src/game/config';
import { createPlayer, updatePlayer } from '../src/game/player';
import type { SimEvent } from '../src/game/types';

const DT = 1 / 60;
const DAMP = 1 / (1 + CONFIG.player.drag * DT);
const R = CONFIG.player.radius;

describe('player', () => {
  it('accelerates at the thrust rate, then Box2D damping applies', () => {
    const p = createPlayer();
    updatePlayer(p, { x: 1, y: 0 }, 1400, DT, []);
    expect(p.vx).toBeCloseTo(1400 * DT * DAMP, 6);
    expect(p.vy).toBe(0);
    expect(p.x).toBeCloseTo(p.vx * DT, 6);
  });

  it('coasts with drag 0.5: about 61% of the speed is left after a second', () => {
    const p = createPlayer();
    p.vx = 600;
    for (let i = 0; i < 60; i++) updatePlayer(p, { x: 0, y: 0 }, 1400, DT, []);
    expect(p.vx).toBeCloseTo(600 * DAMP ** 60, 6);
    expect(p.vx / 600).toBeGreaterThan(0.6);
    expect(p.vx / 600).toBeLessThan(0.62);
  });

  it('never thrusts harder than full stick (diagonals are normalised)', () => {
    const p = createPlayer();
    updatePlayer(p, { x: 1, y: 1 }, 1400, DT, []);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(1400 * DT * DAMP, 6);
  });

  it('bounces off a wall once, keeping 55% of the impact speed', () => {
    const p = createPlayer();
    p.x = HW - R - 1;
    p.vx = 600;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.x).toBe(HW - R);
    expect(p.vx).toBeCloseTo(-0.55 * 600 * DAMP, 6);
    expect(events).toHaveLength(1);
    const e = events[0] as Extract<SimEvent, { type: 'bounce' }>;
    expect(e).toMatchObject({ type: 'bounce', nx: -1, ny: 0 });
    expect(e.x).toBeCloseTo(HW, 9); // the contact point is on the wall
    expect(e.speed).toBeCloseTo(600 * DAMP, 6);
  });

  it('always pushes off at least 180 u/s, silently when the touch was soft', () => {
    const p = createPlayer();
    p.x = HW - R;
    p.vx = 10;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.vx).toBe(-180);
    expect(events).toHaveLength(0);
  });

  it('bounces off the floor and ceiling too', () => {
    const p = createPlayer();
    p.y = -(CONFIG.arena.hh - R) + 1;
    p.vy = -500;
    const events: SimEvent[] = [];
    updatePlayer(p, { x: 0, y: 0 }, 1400, DT, events);
    expect(p.vy).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'bounce', nx: 0, ny: 1 });
  });

  it('does nothing once dead, apart from settling its previous position', () => {
    const p = createPlayer();
    p.alive = false;
    p.x = 5;
    updatePlayer(p, { x: 1, y: 0 }, 1400, DT, []);
    expect(p.x).toBe(5);
    expect(p.px).toBe(5);
    expect(p.vx).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/player.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`web/src/game/player.ts`:
```ts
import { HH, HW } from './arena';
import { CONFIG } from './config';
import type { Player, SimEvent, Vec } from './types';

export function createPlayer(): Player {
  return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, alive: true };
}

/** Thrust, Box2D-style linear damping (drag 0.5, as the 2020 Rigidbody2D), move, then bounce off the walls. */
export function updatePlayer(p: Player, move: Vec, thrust: number, dt: number, events: SimEvent[]): void {
  p.px = p.x;
  p.py = p.y;
  if (!p.alive) return;
  let ix = move.x;
  let iy = move.y;
  const m = Math.hypot(ix, iy);
  if (m > 1) {
    ix /= m;
    iy /= m;
  }
  p.vx += ix * thrust * dt;
  p.vy += iy * thrust * dt;
  const damp = 1 / (1 + CONFIG.player.drag * dt);
  p.vx *= damp;
  p.vy *= damp;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  bounce(p, events);
}

/** One clean bounce per contact: 55% of the impact speed comes back, never less than 180 u/s. */
function bounce(p: Player, events: SimEvent[]): void {
  const { radius: r, restitution, minBounce, bounceEventSpeed } = CONFIG.player;
  const lx = HW - r;
  const ly = HH - r;
  // nx, ny: the wall's normal, pointing into the arena. vn: speed into the wall (≥ 0).
  const hit = (nx: number, ny: number, vn: number) => {
    if (vn > bounceEventSpeed) events.push({ type: 'bounce', x: p.x - nx * r, y: p.y - ny * r, nx, ny, speed: vn });
    return Math.max(restitution * vn, minBounce);
  };
  if (p.x < -lx) {
    p.x = -lx;
    p.vx = hit(1, 0, Math.max(0, -p.vx));
  } else if (p.x > lx) {
    p.x = lx;
    p.vx = -hit(-1, 0, Math.max(0, p.vx));
  }
  if (p.y < -ly) {
    p.y = -ly;
    p.vy = hit(0, 1, Math.max(0, -p.vy));
  } else if (p.y > ly) {
    p.y = ly;
    p.vy = -hit(0, -1, Math.max(0, p.vy));
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/game/player.ts web/tests/player.test.ts
git commit -m "web: add momentum player with drag and one-shot wall bounces"
```

---

### Task 4: Homing missiles

**Files:**
- Create: `web/src/game/missile.ts`
- Test: `web/tests/missile.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `HW`, `HH`, `clamp`, `wallPoint`, `circleCapsuleGap`, `warnTimeOf`, `launchTimeOf`, types.
- Produces: `createMissiles(): Missile[]`, `wrapAngle(a)`, `steer(m, tx, ty, dt)`, `fly(m, dt)`, `keepInside(m)`, `separate(missiles)`, `updateMissiles(missiles, player, dt)`, `gapToPlayer(m, p)`.

- [ ] **Step 1: Write the failing test**

`web/tests/missile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { HH, HW } from '../src/game/arena';
import { createMissiles, gapToPlayer, keepInside, separate, steer, updateMissiles, wrapAngle } from '../src/game/missile';
import { createPlayer } from '../src/game/player';
import type { Missile } from '../src/game/types';

const DT = 1 / 60;
const DEG = Math.PI / 180;

function flying(x: number, y: number, angle: number, speed = 300, turnDeg = 470): Missile {
  const m = createMissiles()[0];
  Object.assign(m, { state: 'flying', x, y, px: x, py: y, angle, pangle: angle, speed, turn: turnDeg * DEG });
  return m;
}

describe('createMissiles', () => {
  it('builds the seven 2020 missiles facing into the arena, warning at the wall', () => {
    const ms = createMissiles();
    expect(ms).toHaveLength(7);
    expect(ms.every((m) => m.state === 'idle')).toBe(true);
    expect(ms[0].angle).toBeCloseTo(0); // from the left, facing right
    expect(ms[0]).toMatchObject({ warnX: -HW, warnY: 0, warnAt: 0, launchAt: 2.75, color: '#ffffff' });
    expect(ms[1].angle).toBeCloseTo(-Math.PI / 2); // from the top, facing down
    expect(ms[1]).toMatchObject({ warnX: 0, warnY: HH });
    expect(ms[4]).toMatchObject({ warnX: HW, warnY: -HH }); // purple, bottom-right corner
    expect(ms[6].speed).toBe(700);
    expect(ms[6].turn).toBeCloseTo(830 * DEG);
  });
});

describe('steer', () => {
  it('turns at sin(error) × turn rate, the 2020 formula', () => {
    const m = flying(0, 0, 0);
    steer(m, 0, 100, DT); // target 90° to the left: full turn rate
    expect(m.angle).toBeCloseTo(470 * DEG * DT, 9);
  });

  it('barely turns when the target is straight behind (sin of 180° is 0)', () => {
    const m = flying(0, 0, 0);
    steer(m, -100, 0, DT);
    expect(Math.abs(m.angle)).toBeLessThan(1e-6);
  });

  it('always flies at its own speed', () => {
    const m = flying(0, 0, 0.3, 450);
    steer(m, 50, 80, DT);
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(450 * DT, 9);
  });

  it('locks onto a target within half a second', () => {
    const m = flying(-300, 0, Math.PI / 2);
    for (let i = 0; i < 30; i++) steer(m, 0, 0, DT);
    const err = wrapAngle(Math.atan2(-m.y, -m.x) - m.angle);
    expect(Math.abs(err)).toBeLessThan(0.1);
  });
});

describe('keepInside', () => {
  it('lets a missile fly in from outside, then keeps it inside', () => {
    const m = flying(-336, 0, 0);
    keepInside(m);
    expect(m.entered).toBe(false);
    expect(m.x).toBe(-336);
    m.x = 0;
    keepInside(m);
    expect(m.entered).toBe(true);
    m.x = 400;
    m.y = -400;
    keepInside(m);
    expect(m.x).toBe(HW - 8);
    expect(m.y).toBe(-(HH - 8));
  });
});

describe('separate', () => {
  it('pushes overlapping flying missiles apart evenly', () => {
    const a = flying(0, 0, 0);
    const b = flying(10, 0, 0);
    separate([a, b]);
    expect(a.x).toBeCloseTo(-2);
    expect(b.x).toBeCloseTo(12);
  });

  it('leaves idle missiles alone', () => {
    const a = flying(0, 0, 0);
    const b = createMissiles()[1];
    b.x = 5;
    b.y = 0;
    separate([a, b]);
    expect(a.x).toBe(0);
    expect(b.x).toBe(5);
  });
});

describe('updateMissiles', () => {
  it('coasts in a straight line after the player dies, ignoring the walls', () => {
    const m = flying(300, 0, 0, 300);
    m.state = 'coasting';
    m.entered = true;
    const p = createPlayer();
    for (let i = 0; i < 30; i++) updateMissiles([m], p, DT);
    expect(m.x).toBeCloseTo(450);
    expect(m.angle).toBe(0);
  });

  it('records the previous pose for interpolation', () => {
    const m = flying(0, 0, 0);
    updateMissiles([m], createPlayer(), DT);
    expect(m.px).toBe(0);
    expect(m.x).toBeGreaterThan(0);
  });

  it('measures the gap to the player from the capsule surface', () => {
    const m = flying(30, 0, 0);
    expect(gapToPlayer(m, createPlayer())).toBeCloseTo(30 - 4.5 - 3.5 - 9.6);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/missile.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`web/src/game/missile.ts`:
```ts
import { clamp, HH, HW, wallPoint } from './arena';
import { circleCapsuleGap } from './collide';
import { CONFIG } from './config';
import { launchTimeOf, warnTimeOf } from './schedule';
import type { Missile, Player } from './types';

const DEG = Math.PI / 180;

export function createMissiles(): Missile[] {
  return CONFIG.missiles.map((d, id) => {
    const w = wallPoint(d.x, d.y);
    const angle = Math.atan2(-d.y, -d.x); // facing the arena centre
    return {
      id,
      color: d.color,
      speed: d.speed,
      turn: d.turn * DEG,
      state: 'idle',
      x: d.x,
      y: d.y,
      px: d.x,
      py: d.y,
      angle,
      pangle: angle,
      spawnX: d.x,
      spawnY: d.y,
      warnX: w.x,
      warnY: w.y,
      warnAt: warnTimeOf(id),
      launchAt: launchTimeOf(id),
      blinks: 0,
      entered: false,
      nearArmed: true,
      lastGap: Infinity,
    };
  });
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function fly(m: Missile, dt: number): void {
  m.x += Math.cos(m.angle) * m.speed * dt;
  m.y += Math.sin(m.angle) * m.speed * dt;
}

/** Turns toward the target at sin(error) × turn rate (the 2020 HomingMissile formula) and flies on. */
export function steer(m: Missile, tx: number, ty: number, dt: number): void {
  const err = wrapAngle(Math.atan2(ty - m.y, tx - m.x) - m.angle);
  m.angle = wrapAngle(m.angle + Math.sin(err) * m.turn * dt);
  fly(m, dt);
}

/** A missile flies in from outside; once fully inside the arena it stays inside. */
export function keepInside(m: Missile): void {
  const e = CONFIG.missile.enterMargin;
  const lx = HW - e;
  const ly = HH - e;
  if (!m.entered) {
    if (Math.abs(m.x) > lx || Math.abs(m.y) > ly) return;
    m.entered = true;
  }
  m.x = clamp(m.x, -lx, lx);
  m.y = clamp(m.y, -ly, ly);
}

/** Overlapping flying missiles are pushed apart so they never merge into one blob. */
export function separate(missiles: Missile[]): void {
  const d0 = CONFIG.missile.separation;
  for (let i = 0; i < missiles.length; i++) {
    const a = missiles[i];
    if (a.state !== 'flying') continue;
    for (let j = i + 1; j < missiles.length; j++) {
      const b = missiles[j];
      if (b.state !== 'flying') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= d0) continue;
      const nx = d > 0 ? dx / d : 1;
      const ny = d > 0 ? dy / d : 0;
      const push = (d0 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

export function updateMissiles(missiles: Missile[], player: Player, dt: number): void {
  for (const m of missiles) {
    m.px = m.x;
    m.py = m.y;
    m.pangle = m.angle;
    if (m.state === 'flying') steer(m, player.x, player.y, dt);
    else if (m.state === 'coasting') fly(m, dt);
  }
  separate(missiles);
  for (const m of missiles) if (m.state === 'flying') keepInside(m);
}

/** Gap between a missile's capsule and the player's circle (negative = touching). */
export function gapToPlayer(m: Missile, p: Player): number {
  return circleCapsuleGap(p.x, p.y, CONFIG.player.radius, m.x, m.y, m.angle, CONFIG.missile.length, CONFIG.missile.radius);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/game/missile.ts web/tests/missile.test.ts
git commit -m "web: add homing missiles with the 2020 turn formula, entry clamp and separation"
```

---

### Task 5: Cannons, arrows and slow-mo

**Files:**
- Create: `web/src/game/hazards.ts`, `web/src/game/slowmo.ts`
- Test: `web/tests/hazards.test.ts`, `web/tests/slowmo.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `HW`, `arrowCorners`, `circleTriangle`, types.
- Produces:
  - hazards: `createCannons(): Cannon[]`, `fireCannons(world: World, dt)`, `moveArrows(arrows: Arrow[], dt)`, `arrowHits(a: Arrow, p: Player): boolean`
  - slowmo: `createSlowMo(): SlowMo`, `toggleSlowMo(s, allowed, events)`, `setSlowMo(s, on, events)`, `updateSlowMo(s, realDt, events)`, `timeScale(s): number`

- [ ] **Step 1: Write the failing tests**

`web/tests/hazards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { HW } from '../src/game/arena';
import { arrowHits, createCannons, fireCannons, moveArrows } from '../src/game/hazards';
import { createPlayer } from '../src/game/player';
import type { Arrow, World } from '../src/game/types';

/** Just the parts of a world the cannons touch. */
const cannonWorld = () => ({ cannons: createCannons(), arrows: [], cannonClock: 0, events: [] }) as unknown as World;

describe('cannons', () => {
  it('sit just outside the top-left and bottom-right walls, facing across', () => {
    expect(createCannons()).toEqual([
      { x: -319, y: 156, dir: 1, tip: -1 },
      { x: 319, y: -156, dir: -1, tip: 1 },
    ]);
  });

  it('both fire at once, then every 0.3 s of world time', () => {
    const w = cannonWorld();
    fireCannons(w, 0);
    expect(w.arrows).toHaveLength(2);
    expect(w.events.filter((e) => e.type === 'fire')).toHaveLength(2);
    fireCannons(w, 0.29);
    expect(w.arrows).toHaveLength(2);
    fireCannons(w, 0.02);
    expect(w.arrows).toHaveLength(4);
  });

  it('fires four volleys in just under a second', () => {
    const w = cannonWorld();
    for (let i = 0; i < 14; i++) fireCannons(w, 0.07);
    expect(w.arrows).toHaveLength(8);
  });
});

describe('arrows', () => {
  const arrow = (x: number, dir: 1 | -1): Arrow => ({ x, y: 156, px: x, dir, tip: -1 });

  it('slide along their lane at 70 u/s', () => {
    const arrows = [arrow(-319, 1)];
    moveArrows(arrows, 1);
    expect(arrows[0].x).toBeCloseTo(-249);
    expect(arrows[0].px).toBe(-319);
  });

  it('are removed once fully past the far wall', () => {
    const arrows = [arrow(HW + 5, 1), arrow(HW + 7, 1), arrow(-HW - 7, -1)];
    moveArrows(arrows, 0);
    expect(arrows.map((a) => a.x)).toEqual([HW + 5]);
  });

  it('kill a player who touches them', () => {
    const p = createPlayer();
    p.x = 0;
    p.y = 141.5;
    expect(arrowHits(arrow(0, 1), p)).toBe(true);
    p.y = 140;
    expect(arrowHits(arrow(0, 1), p)).toBe(false);
  });
});
```

`web/tests/slowmo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createSlowMo, timeScale, toggleSlowMo, updateSlowMo } from '../src/game/slowmo';
import type { SimEvent } from '../src/game/types';

describe('slow-mo', () => {
  it('stays locked until it is allowed', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, false, events);
    expect(s.active).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('toggles on and off, slowing the world to 0.1×', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, true, events);
    expect(s.active).toBe(true);
    expect(timeScale(s)).toBe(0.1);
    toggleSlowMo(s, true, events);
    expect(timeScale(s)).toBe(1);
    expect(events).toEqual([
      { type: 'slowmo', on: true },
      { type: 'slowmo', on: false },
    ]);
  });

  it('drains in real seconds and switches itself off when empty', () => {
    const s = createSlowMo();
    const events: SimEvent[] = [];
    toggleSlowMo(s, true, events);
    updateSlowMo(s, 2, events);
    expect(s.meter).toBeCloseTo(3);
    updateSlowMo(s, 3.5, events);
    expect(s.meter).toBe(0);
    expect(s.active).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'slowmo', on: false });
  });

  it('refills at half speed while off, up to 5 s', () => {
    const s = createSlowMo();
    s.meter = 0;
    updateSlowMo(s, 4, []);
    expect(s.meter).toBeCloseTo(2);
    updateSlowMo(s, 100, []);
    expect(s.meter).toBe(5);
  });

  it('needs a quarter second in the meter to start', () => {
    const s = createSlowMo();
    s.meter = 0.2;
    toggleSlowMo(s, true, []);
    expect(s.active).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/hazards.test.ts tests/slowmo.test.ts`
Expected: FAIL (modules `hazards` and `slowmo` not found).

- [ ] **Step 3: Implement**

`web/src/game/hazards.ts`:
```ts
import { HW } from './arena';
import { arrowCorners, circleTriangle } from './collide';
import { CONFIG } from './config';
import type { Arrow, Cannon, Player, World } from './types';

export function createCannons(): Cannon[] {
  const c = CONFIG.cannon;
  return [
    { x: -c.x, y: c.laneY, dir: 1, tip: -1 },
    { x: c.x, y: -c.laneY, dir: -1, tip: 1 },
  ];
}

/** Both cannons fire together every interval of world time. */
export function fireCannons(world: World, dt: number): void {
  world.cannonClock -= dt;
  while (world.cannonClock <= 0) {
    for (const c of world.cannons) {
      world.arrows.push({ x: c.x, y: c.y, px: c.x, dir: c.dir, tip: c.tip });
      world.events.push({ type: 'fire', x: c.x, y: c.y, dir: c.dir });
    }
    world.cannonClock += CONFIG.cannon.interval;
  }
}

/** Slides arrows along their lanes and drops the ones fully past the far wall. */
export function moveArrows(arrows: Arrow[], dt: number): void {
  const { arrowSpeed, arrowW } = CONFIG.cannon;
  let write = 0;
  for (const a of arrows) {
    a.px = a.x;
    a.x += a.dir * arrowSpeed * dt;
    const back = a.x - (a.dir * arrowW) / 2;
    if (a.dir > 0 ? back > HW : back < -HW) continue;
    arrows[write++] = a;
  }
  arrows.length = write;
}

export function arrowHits(a: Arrow, p: Player): boolean {
  const [A, B, C] = arrowCorners(a.x, a.y, a.tip, CONFIG.cannon.arrowW, CONFIG.cannon.arrowH);
  return circleTriangle(p.x, p.y, CONFIG.player.radius, A.x, A.y, B.x, B.y, C.x, C.y);
}
```

`web/src/game/slowmo.ts`:
```ts
import { CONFIG } from './config';
import type { SimEvent, SlowMo } from './types';

export function createSlowMo(): SlowMo {
  return { active: false, meter: CONFIG.slowmo.capacity };
}

export function setSlowMo(s: SlowMo, on: boolean, events: SimEvent[]): void {
  if (s.active === on) return;
  s.active = on;
  events.push({ type: 'slowmo', on });
}

/** Switching off always works; switching on needs permission and a little meter. */
export function toggleSlowMo(s: SlowMo, allowed: boolean, events: SimEvent[]): void {
  if (s.active) setSlowMo(s, false, events);
  else if (allowed && s.meter >= CONFIG.slowmo.minStart) setSlowMo(s, true, events);
}

/** Runs on real time: drains while on (switching off when empty), refills while off. */
export function updateSlowMo(s: SlowMo, realDt: number, events: SimEvent[]): void {
  const c = CONFIG.slowmo;
  if (s.active) {
    s.meter = Math.max(0, s.meter - realDt);
    if (s.meter === 0) setSlowMo(s, false, events);
  } else {
    s.meter = Math.min(c.capacity, s.meter + c.refill * realDt);
  }
}

export function timeScale(s: SlowMo): number {
  return s.active ? CONFIG.slowmo.scale : 1;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/game/hazards.ts web/src/game/slowmo.ts web/tests/hazards.test.ts web/tests/slowmo.test.ts
git commit -m "web: add stage-6 cannons, spike arrows and the slow-mo meter"
```

---

### Task 6: Simulation

**Files:**
- Create: `web/src/game/sim.ts`, `web/tests/helpers.ts`
- Test: `web/tests/sim.test.ts`

**Interfaces:**
- Consumes: everything in `src/game/`.
- Produces: `createWorld(): World`, `step(world, input: StepInput, dt): void`, `drainEvents(world): SimEvent[]`. Test helpers: `IDLE`, `run(world, seconds, input?)`, `quiet(world)`, `runningWorld(elapsed)`, `launch(world, id, x, y, angle)`.

- [ ] **Step 1: Write the helpers and the failing test**

`web/tests/helpers.ts`:
```ts
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
```

`web/tests/sim.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, step } from '../src/game/sim';
import type { SimEvent } from '../src/game/types';
import { IDLE, launch, run, runningWorld } from './helpers';

const of = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

describe('a new run', () => {
  it('starts in the intro with seven idle missiles and 120 on the clock', () => {
    const w = createWorld();
    expect(w.phase).toBe('intro');
    expect(w.stage).toBe(1);
    expect(w.shown).toBe(120);
    expect(w.missiles.map((m) => m.state)).toEqual(Array(7).fill('idle'));
  });

  it('warns about the white missile, blinks three times, then launches it and starts the countdown', () => {
    const w = createWorld();
    let events = run(w, 2.7);
    expect(of(events, 'warn').map((e) => e.id)).toEqual([0]);
    expect(of(events, 'blink').map((e) => e.n)).toEqual([1, 2, 3]);
    expect(of(events, 'launch')).toHaveLength(0);
    expect(w.phase).toBe('intro');
    expect(w.elapsed).toBe(0);
    events = run(w, 0.1);
    expect(of(events, 'launch')).toMatchObject([{ id: 0, x: -312, y: 0 }]);
    expect(w.phase).toBe('running');
    expect(w.missiles[0].state).toBe('flying');
    expect(w.elapsed).toBeGreaterThan(0);
  });
});

describe('stages and countdown', () => {
  it('announces stage 2 at 17 s, together with the red missile warning', () => {
    const w = runningWorld(16.95);
    w.missiles[1].warnAt = w.time + 0.05;
    const events = run(w, 0.1);
    expect(of(events, 'stage')).toEqual([{ type: 'stage', stage: 2 }]);
    expect(of(events, 'warn').map((e) => e.id)).toEqual([1]);
    expect(w.stage).toBe(2);
  });

  it('ticks each of the last ten seconds', () => {
    const w = runningWorld(109.5);
    const events = run(w, 11);
    expect(of(events, 'tick').map((e) => e.remaining)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('wins when the countdown reaches 0, then freezes', () => {
    const w = runningWorld(119.9);
    const events = run(w, 0.2);
    expect(of(events, 'win')).toHaveLength(1);
    expect(w.phase).toBe('won');
    expect(w.elapsed).toBe(CONFIG.countdown);
    const m = launch(w, 2, 100, 0, 0);
    run(w, 0.5);
    expect(m.x).toBe(100);
  });

  it('after the win nothing can kill you', () => {
    const w = runningWorld(119.99);
    run(w, 0.05);
    expect(w.phase).toBe('won');
    launch(w, 1, 0, 0, 0); // right on top of the player
    const events = run(w, 0.5);
    expect(of(events, 'death')).toHaveLength(0);
    expect(w.player.alive).toBe(true);
  });
});

describe('death', () => {
  it('dies when a missile touches the dot; missiles stop homing and coast away', () => {
    const w = runningWorld(10);
    const m = launch(w, 1, 20, 0, Math.PI);
    const events = run(w, 0.1);
    expect(of(events, 'death')).toMatchObject([{ by: 'missile' }]);
    expect(w.phase).toBe('dead');
    expect(w.player.alive).toBe(false);
    expect(m.state).toBe('coasting');
    const angle = m.angle;
    const x = m.x;
    run(w, 0.5);
    expect(m.angle).toBe(angle);
    expect(m.x).toBeCloseTo(x - m.speed * 0.5, 0);
  });

  it('dies on a spike arrow', () => {
    const w = runningWorld(100);
    w.player.y = w.player.py = 141.5;
    w.arrows.push({ x: 0, y: 156, px: 0, dir: 1, tip: -1 });
    const events = run(w, CONFIG.step);
    expect(of(events, 'death')).toMatchObject([{ by: 'arrow' }]);
  });

  it('freezes the countdown at the moment of death', () => {
    const w = runningWorld(42);
    launch(w, 1, 15, 0, Math.PI);
    run(w, 0.1);
    const at = w.elapsed;
    run(w, 2);
    expect(w.elapsed).toBe(at);
  });

  it('switches slow-mo off on death', () => {
    const w = runningWorld(100);
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(w.slowmo.active).toBe(true);
    drainEvents(w);
    launch(w, 1, 14, 0, Math.PI);
    const events = run(w, 0.5);
    expect(of(events, 'slowmo')).toEqual([{ type: 'slowmo', on: false }]);
    expect(w.slowmo.active).toBe(false);
  });
});

describe('near misses', () => {
  it('fires once when a missile shaves past without touching', () => {
    const w = runningWorld(10);
    const m = launch(w, 0, -150, 20, 0);
    m.turn = 0; // fly straight past
    const events = run(w, 1);
    expect(of(events, 'nearMiss')).toHaveLength(1);
    expect(of(events, 'death')).toHaveLength(0);
  });
});

describe('slow-mo in the world', () => {
  it('is ignored before stage 6 and after death', () => {
    const early = runningWorld(50);
    step(early, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(early.slowmo.active).toBe(false);
    const dead = runningWorld(100);
    dead.phase = 'dead';
    dead.player.alive = false;
    step(dead, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(dead.slowmo.active).toBe(false);
  });

  it('slows world time to 0.1× while the meter runs on real time', () => {
    const w = runningWorld(100);
    const t0 = w.time;
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    expect(w.time - t0).toBeCloseTo(CONFIG.step * 0.1, 9);
    expect(w.slowmo.meter).toBeCloseTo(CONFIG.slowmo.capacity - CONFIG.step, 9);
  });

  it('only changes the meter when the world steps (a paused game does not drain it)', () => {
    const w = runningWorld(100);
    step(w, { ...IDLE, slowmo: true }, CONFIG.step);
    const meter = w.slowmo.meter;
    // main.ts does not call step() while paused; nothing else touches the meter.
    expect(w.slowmo.meter).toBe(meter);
  });

  it('gives the dot the stronger 2020 slow-mo thrust', () => {
    const w = runningWorld(100);
    step(w, { move: { x: 1, y: 0 }, slowmo: true }, CONFIG.step);
    const dt = CONFIG.step * 0.1;
    expect(w.player.vx).toBeCloseTo((3000 * dt) / (1 + 0.5 * dt), 6);
  });
});

describe('cannons in the world', () => {
  it('start firing at stage 6', () => {
    const before = runningWorld(90);
    expect(of(run(before, 1), 'fire')).toHaveLength(0);
    const after = runningWorld(97);
    expect(of(run(after, 0.5), 'fire').length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/sim.test.ts`
Expected: FAIL (module `../src/game/sim` not found).

- [ ] **Step 3: Implement**

`web/src/game/sim.ts`:
```ts
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
    runSchedule(world);
  }
  const p = world.player;
  const thrust = world.slowmo.active ? CONFIG.player.slowmoThrust : CONFIG.player.thrust;
  updatePlayer(p, live ? input.move : ZERO, thrust, wdt, world.events);
  updateMissiles(world.missiles, p, wdt);
  if (live && world.elapsed >= CONFIG.cannon.startAt) fireCannons(world, wdt);
  moveArrows(world.arrows, wdt);
  if (live) collide(world);
  if (world.phase === 'running' && world.elapsed >= CONFIG.countdown) win(world);
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/game/sim.ts web/tests/helpers.ts web/tests/sim.test.ts
git commit -m "web: add the simulation: intro, schedule, stages, countdown, death, win, near misses"
```

---

### Task 7: View (arena fit and portrait rotation) and input

**Files:**
- Create: `web/src/render/view.ts`, `web/src/input/keyboard.ts`, `web/src/input/shortcuts.ts`, `web/src/input/touch.ts`
- Create (types only, filled in Task 9): `web/src/ui/screens.ts` starts with just the two exported types
- Test: `web/tests/view.test.ts`, `web/tests/keyboard.test.ts`, `web/tests/shortcuts.test.ts`

**Interfaces:**
- Consumes: `HW`, `HH`, `Vec`.
- Produces:
  - view: `View { cssW, cssH, portrait, scale, x, y, w, h, cx, cy }`, `HUD_MARGIN`, `hudBand(cssH)`, `fitView(cssW, cssH)`, `toScreen(v, wx, wy): Vec`, `screenDirToWorld(v, dx, dy): Vec` (screen dir has x right, y up), `worldMatrix(v): [a, b, c, d, e, f]`
  - `createKeyboard(target, capture?): { dir(): Vec; dispose() }` (screen directions, unit length)
  - `shortcutFor(key: KeyInfo, screen: ScreenName): { action: Shortcut | null; preventDefault }`, with `Shortcut = 'pause' | 'resume' | 'back' | 'restart' | 'start' | 'mute' | 'slowmo'`
  - `createJoystick(el, radius?): { dir(): Vec; view(): JoystickView | null; setEnabled(on); dispose() }` (dir in screen space, y up)
  - `ScreenName = 'title' | 'options' | 'playing' | 'paused' | 'gameover' | 'congrats'`, `UIAction` (from `ui/screens.ts`)

- [ ] **Step 1: Seed `ui/screens.ts` with its types** (the rest arrives in Task 9)

```ts
export type ScreenName = 'title' | 'options' | 'playing' | 'paused' | 'gameover' | 'congrats';
export type UIAction = 'play' | 'options' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'slowmo' | 'toggleMute';
```

- [ ] **Step 2: Write the failing tests**

`web/tests/view.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { HH, HW } from '../src/game/arena';
import { fitView, HUD_MARGIN, hudBand, screenDirToWorld, toScreen, worldMatrix, type View } from '../src/render/view';

function fitsInside(v: View) {
  expect(v.x).toBeGreaterThanOrEqual(HUD_MARGIN - 1e-9);
  expect(v.x + v.w).toBeLessThanOrEqual(v.cssW - HUD_MARGIN + 1e-9);
  expect(v.y).toBeGreaterThanOrEqual(hudBand(v.cssH) - 1e-9); // the HUD band stays clear of the arena
  expect(v.y + v.h).toBeLessThanOrEqual(v.cssH - HUD_MARGIN + 1e-9);
}

describe('fitView', () => {
  it('fits the 1.95:1 arena under the HUD band of the itch embed', () => {
    const v = fitView(1024, 576);
    expect(v.portrait).toBe(false);
    expect(v.w / v.h).toBeCloseTo((2 * HW) / (2 * HH), 6);
    expect(v.w).toBeGreaterThan(950);
    fitsInside(v);
  });

  it('fits a landscape phone', () => {
    const v = fitView(844, 390);
    expect(v.portrait).toBe(false);
    fitsInside(v);
  });

  it('turns the arena a quarter turn on a portrait phone', () => {
    const v = fitView(390, 844);
    expect(v.portrait).toBe(true);
    expect(v.h / v.w).toBeCloseTo((2 * HW) / (2 * HH), 6);
    fitsInside(v);
  });

  it('keeps the band between 44 and 64 px', () => {
    expect(hudBand(300)).toBe(44);
    expect(hudBand(1400)).toBe(64);
  });
});

describe('transforms', () => {
  it('maps world corners onto the arena rectangle (landscape)', () => {
    const v = fitView(1024, 576);
    expect(toScreen(v, HW, HH).x).toBeCloseTo(v.x + v.w);
    expect(toScreen(v, HW, HH).y).toBeCloseTo(v.y);
    expect(toScreen(v, -HW, -HH).y).toBeCloseTo(v.y + v.h);
  });

  it('points world +x up the screen in portrait', () => {
    const v = fitView(390, 844);
    expect(toScreen(v, HW, 0).y).toBeCloseTo(v.y);
    expect(toScreen(v, 0, HH).x).toBeCloseTo(v.x);
  });

  it('turns screen directions into the world direction that looks the same on screen', () => {
    for (const v of [fitView(1024, 576), fitView(390, 844)]) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.6, -0.8]]) {
        const d = screenDirToWorld(v, dx, dy);
        const a = toScreen(v, 0, 0);
        const b = toScreen(v, d.x, d.y);
        expect((b.x - a.x) / v.scale).toBeCloseTo(dx);
        expect(-(b.y - a.y) / v.scale).toBeCloseTo(dy); // screen y grows downward
      }
    }
  });

  it('agrees with the canvas matrix the renderer uses', () => {
    for (const v of [fitView(1024, 576), fitView(390, 844)]) {
      const [a, b, c, d, e, f] = worldMatrix(v);
      const p = toScreen(v, 100, -40);
      expect(a * 100 + c * -40 + e).toBeCloseTo(p.x);
      expect(b * 100 + d * -40 + f).toBeCloseTo(p.y);
    }
  });
});
```

`web/tests/keyboard.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createKeyboard } from '../src/input/keyboard';

function key(target: EventTarget, type: 'keydown' | 'keyup', code: string): Event {
  const e = Object.assign(new Event(type, { cancelable: true }), { code });
  target.dispatchEvent(e);
  return e;
}

describe('keyboard', () => {
  it('maps WASD and arrows to a unit direction', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyD');
    expect(kb.dir()).toEqual({ x: 1, y: 0 });
    key(t, 'keydown', 'ArrowUp');
    expect(kb.dir().x).toBeCloseTo(Math.SQRT1_2);
    expect(kb.dir().y).toBeCloseTo(Math.SQRT1_2);
    key(t, 'keyup', 'KeyD');
    expect(kb.dir()).toEqual({ x: 0, y: 1 });
  });

  it('cancels opposite keys', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyA');
    key(t, 'keydown', 'ArrowRight');
    expect(kb.dir().x).toBe(0);
  });

  it('releases every key when the window loses focus', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyS');
    t.dispatchEvent(new Event('blur'));
    expect(kb.dir()).toEqual({ x: 0, y: 0 });
  });

  it('stops movement keys from scrolling the page unless told not to', () => {
    const t = new EventTarget();
    let capture = true;
    createKeyboard(t, () => capture);
    expect(key(t, 'keydown', 'ArrowDown').defaultPrevented).toBe(true);
    expect(key(t, 'keydown', 'KeyQ').defaultPrevented).toBe(false);
    capture = false; // e.g. the Options sliders want their arrow keys
    expect(key(t, 'keydown', 'ArrowLeft').defaultPrevented).toBe(false);
  });
});
```

`web/tests/shortcuts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyInfo } from '../src/input/shortcuts';

const key = (code: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  code,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  onButton: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('maps the single-key shortcuts per screen', () => {
    expect(shortcutFor(key('Escape'), 'playing').action).toBe('pause');
    expect(shortcutFor(key('KeyP'), 'paused').action).toBe('resume');
    expect(shortcutFor(key('Escape'), 'options').action).toBe('back');
    expect(shortcutFor(key('KeyR'), 'gameover').action).toBe('restart');
    expect(shortcutFor(key('KeyR'), 'congrats').action).toBe('restart');
    expect(shortcutFor(key('KeyR'), 'title').action).toBeNull();
    expect(shortcutFor(key('Enter'), 'title').action).toBe('start');
    expect(shortcutFor(key('Space'), 'gameover').action).toBe('start');
    expect(shortcutFor(key('Space'), 'paused').action).toBe('resume');
    expect(shortcutFor(key('KeyM'), 'playing').action).toBe('mute');
  });

  it('toggles slow-mo with X only while playing', () => {
    expect(shortcutFor(key('KeyX'), 'playing').action).toBe('slowmo');
    expect(shortcutFor(key('KeyX'), 'paused').action).toBeNull();
    expect(shortcutFor(key('KeyX', { repeat: true }), 'playing').action).toBeNull();
  });

  it('ignores keys pressed with Ctrl, Cmd or Alt (print, reload, browser chords)', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(shortcutFor(key('KeyP', { [mod]: true }), 'playing')).toEqual({ action: null, preventDefault: false });
      expect(shortcutFor(key('KeyR', { [mod]: true }), 'playing').action).toBeNull();
      expect(shortcutFor(key('KeyX', { [mod]: true }), 'playing').action).toBeNull();
    }
  });

  it('keeps a held Space from scrolling the page, without repeating the action', () => {
    expect(shortcutFor(key('Space', { repeat: true }), 'title')).toEqual({ action: null, preventDefault: true });
    expect(shortcutFor(key('Space'), 'playing')).toEqual({ action: null, preventDefault: true });
  });

  it('leaves Enter and Space to a focused button', () => {
    expect(shortcutFor(key('Enter', { onButton: true }), 'title')).toEqual({ action: null, preventDefault: false });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/view.test.ts tests/keyboard.test.ts tests/shortcuts.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`web/src/render/view.ts`:
```ts
import { HH, HW } from '../game/arena';
import type { Vec } from '../game/types';

/** Where the arena sits on screen, in CSS pixels. */
export interface View {
  cssW: number;
  cssH: number;
  /** Taller than wide: the arena is drawn a quarter turn round, world +x pointing up the screen. */
  portrait: boolean;
  /** CSS pixels per world unit. */
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export const HUD_MARGIN = 12;

/** Height of the HUD strip above the arena. */
export function hudBand(cssH: number): number {
  return Math.min(64, Math.max(44, cssH * 0.09));
}

export function fitView(cssW: number, cssH: number): View {
  const portrait = cssH > cssW;
  const band = hudBand(cssH);
  const worldW = portrait ? 2 * HH : 2 * HW;
  const worldH = portrait ? 2 * HW : 2 * HH;
  const availW = Math.max(1, cssW - 2 * HUD_MARGIN);
  const availH = Math.max(1, cssH - band - HUD_MARGIN);
  const scale = Math.min(availW / worldW, availH / worldH);
  const w = worldW * scale;
  const h = worldH * scale;
  const x = (cssW - w) / 2;
  const y = band + (availH - h) / 2;
  return { cssW, cssH, portrait, scale, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

export function toScreen(v: View, wx: number, wy: number): Vec {
  return v.portrait
    ? { x: v.cx - wy * v.scale, y: v.cy - wx * v.scale }
    : { x: v.cx + wx * v.scale, y: v.cy - wy * v.scale };
}

/** A screen direction (x right, y up) as the world direction that looks the same on screen. */
export function screenDirToWorld(v: View, dx: number, dy: number): Vec {
  return v.portrait ? { x: dy, y: -dx } : { x: dx, y: dy };
}

/** Canvas setTransform() arguments (CSS pixels) for drawing in world units. */
export function worldMatrix(v: View): [number, number, number, number, number, number] {
  const k = v.scale;
  return v.portrait ? [0, -k, -k, 0, v.cx, v.cy] : [k, 0, 0, -k, v.cx, v.cy];
}
```

`web/src/input/keyboard.ts`:
```ts
import type { Vec } from '../game/types';

// Physical key codes, so ZQSD on AZERTY keyboards works too.
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export interface Keyboard {
  /** Screen direction (x right, y up), unit length or zero. */
  dir(): Vec;
  dispose(): void;
}

/** `capture` decides whether movement keys are kept from the browser (scrolling); they are tracked either way. */
export function createKeyboard(target: EventTarget, capture: () => boolean = () => true): Keyboard {
  const held = new Set<string>();
  const onDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (!MOVE.has(code)) return;
    held.add(code);
    if (capture()) e.preventDefault();
  };
  const onUp = (e: Event) => {
    held.delete((e as KeyboardEvent).code);
  };
  const onBlur = () => held.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  const any = (codes: string[]) => codes.some((c) => held.has(c));
  return {
    dir() {
      const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      const y = (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0);
      const m = Math.hypot(x, y);
      return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 0 };
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
```

`web/src/input/shortcuts.ts`:
```ts
import type { ScreenName } from '../ui/screens';

export type Shortcut = 'pause' | 'resume' | 'back' | 'restart' | 'start' | 'mute' | 'slowmo';

export interface KeyInfo {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The key went to a focused button, which handles Enter/Space itself. */
  onButton: boolean;
}

/** What a key press does on a screen, and whether to stop the browser's default (page scroll). */
export function shortcutFor(k: KeyInfo, screen: ScreenName): { action: Shortcut | null; preventDefault: boolean } {
  const none = { action: null, preventDefault: false };
  if (k.ctrlKey || k.metaKey || k.altKey) return none; // leave print, reload and other browser chords alone

  if (k.code === 'Enter' || k.code === 'Space') {
    if (k.onButton) return none;
    // Always stop Space from scrolling the embedding page, even while it auto-repeats.
    if (k.repeat) return { action: null, preventDefault: true };
    const action =
      screen === 'title' || screen === 'gameover' || screen === 'congrats' ? 'start' : screen === 'paused' ? 'resume' : null;
    return { action, preventDefault: true };
  }
  if (k.repeat) return none;

  switch (k.code) {
    case 'Escape':
    case 'KeyP':
      if (screen === 'playing') return { action: 'pause', preventDefault: false };
      if (screen === 'paused') return { action: 'resume', preventDefault: false };
      if (screen === 'options') return { action: 'back', preventDefault: false };
      return none;
    case 'KeyR':
      return screen === 'playing' || screen === 'paused' || screen === 'gameover' || screen === 'congrats'
        ? { action: 'restart', preventDefault: false }
        : none;
    case 'KeyM':
      return { action: 'mute', preventDefault: false };
    case 'KeyX':
      return screen === 'playing' ? { action: 'slowmo', preventDefault: false } : none;
  }
  return none;
}
```

`web/src/input/touch.ts`:
```ts
import type { Vec } from '../game/types';

export interface JoystickView {
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  radius: number;
}

export interface Joystick {
  /** Screen direction (x right, y up), magnitude ≤ 1: analog thrust. */
  dir(): Vec;
  view(): JoystickView | null;
  setEnabled(on: boolean): void;
  dispose(): void;
}

const DEAD_ZONE = 0.08;

/**
 * Floating thrust joystick: press anywhere on `el` to set the anchor, drag to steer.
 * Dragging past the radius pulls the anchor along so you never run out of room.
 */
export function createJoystick(el: HTMLElement, radius = 56): Joystick {
  let enabled = false;
  let pointerId: number | null = null;
  let ax = 0;
  let ay = 0;
  let kx = 0;
  let ky = 0;

  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: PointerEvent) => {
    if (!enabled || pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    const p = local(e);
    ax = kx = p.x;
    ay = ky = p.y;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const p = local(e);
    kx = p.x;
    ky = p.y;
    const dx = kx - ax;
    const dy = ky - ay;
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      ax = kx - (dx / d) * radius;
      ay = ky - (dy / d) * radius;
    }
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === pointerId) pointerId = null;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  return {
    dir() {
      if (pointerId === null) return { x: 0, y: 0 };
      const dx = (kx - ax) / radius;
      const dy = (ky - ay) / radius;
      const m = Math.hypot(dx, dy);
      if (m < DEAD_ZONE) return { x: 0, y: 0 };
      const s = m > 1 ? 1 / m : 1;
      return { x: dx * s, y: -dy * s }; // screen y points down; directions use y up
    },
    view() {
      if (pointerId === null) return null;
      return { ax, ay, kx, ky, radius };
    },
    setEnabled(on) {
      enabled = on;
      if (!on) pointerId = null;
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    },
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/render/view.ts web/src/input web/src/ui/screens.ts web/tests/view.test.ts web/tests/keyboard.test.ts web/tests/shortcuts.test.ts
git commit -m "web: add arena fit with portrait rotation, keyboard, shortcuts and thrust joystick"
```

---

### Task 8: Rendering, effects and a playable harness

**Files:**
- Create: `web/src/render/tween.ts`, `web/src/render/shapes.ts`, `web/src/render/trails.ts`, `web/src/render/motion.ts`, `web/src/render/fx.ts`, `web/src/render/renderer.ts`
- Create (temporary harness, replaced in Task 11): `web/index.html`, `web/src/main.ts`
- Test: `web/tests/shapes.test.ts`, `web/tests/trails.test.ts`, `web/tests/motion.test.ts`, `web/tests/fx.test.ts`

**Interfaces:**
- Consumes: the sim, `View` helpers, `JoystickView`.
- Produces:
  - tween: `RGB`, `clamp01`, `lerp`, `lerpAngle`, `easeOutBack`, `approach`, `hexToRgb`, `rgbToCss`, `mixRgb`
  - shapes: `roundRectPath(ctx, x, y, w, h, r)`, `capsulePath(ctx, length, radius)`, `chevronPath(ctx, size)`
  - trails: `trailSegments(samples, now, maxAge)`, `createTrail(): Trail { push(x, y, now); draw(ctx, now, maxAge, width, color); clear() }`
  - motion: `createMotion(): DotMotion { update(vx, vy, dt); bounce(nx, ny, speed); pose(): DotPose; reset() }`, `DotPose { angle, along, across, shiftX, shiftY }`
  - fx: `createFx(reducedMotion): Fx { handle(events, world); update(dt); draw(ctx); shakeOffset(): Vec; flash(): { rgb, alpha }; pulse(): number; popped(id): boolean; reset(); stats() }`
  - renderer: `createRenderer(canvas): Renderer { resize(): View; view(): View; draw(world | null, fx, alpha, joystick, dt); onEvents(events, world) }`

- [ ] **Step 1: Write the failing tests**

`web/tests/shapes.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { roundRectPath } from '../src/render/shapes';

function fakeCtx(withRoundRect: boolean) {
  const ctx = {
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    roundRect: withRoundRect ? vi.fn() : undefined,
  };
  return ctx;
}

describe('roundRectPath', () => {
  it('uses roundRect when the browser has it', () => {
    const ctx = fakeCtx(true);
    roundRectPath(ctx as unknown as CanvasRenderingContext2D, 0, 0, 10, 10, 2);
    expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 10, 10, 2);
    expect(ctx.arcTo).not.toHaveBeenCalled();
  });

  it('falls back to arcTo on Safari before 16', () => {
    const ctx = fakeCtx(false);
    roundRectPath(ctx as unknown as CanvasRenderingContext2D, 0, 0, 10, 10, 2);
    expect(ctx.arcTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});
```

`web/tests/trails.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { trailSegments } from '../src/render/trails';

describe('trailSegments', () => {
  const samples = [0, 0.05, 0.1, 0.15, 0.2].map((t, i) => ({ x: i * 10, y: 0, t }));

  it('keeps only segments younger than maxAge, oldest first and thinnest first', () => {
    const segs = trailSegments(samples, 0.2, 0.12);
    expect(segs.length).toBe(2);
    expect(segs[0].x0).toBe(20);
    expect(segs[1].x1).toBe(40);
    expect(segs[0].k).toBeLessThan(segs[1].k);
  });

  it('never returns a negative weight', () => {
    for (const s of trailSegments(samples, 5, 10)) expect(s.k).toBeGreaterThanOrEqual(0);
  });
});
```

`web/tests/motion.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createMotion } from '../src/render/motion';

const run = (m: ReturnType<typeof createMotion>, vx: number, vy: number, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) m.update(vx, vy, 1 / 60);
};

describe('dot squash & stretch', () => {
  it('is round at rest', () => {
    const m = createMotion();
    run(m, 0, 0, 0.5);
    expect(m.pose().along).toBeCloseTo(1, 3);
  });

  it('stretches along its motion, capped', () => {
    const m = createMotion();
    run(m, 900, 0, 1);
    expect(m.pose().along).toBeGreaterThan(1.12);
    expect(m.pose().along).toBeLessThan(1.2);
    expect(m.pose().angle).toBeCloseTo(0, 2);
    run(m, 5000, 0, 1);
    expect(m.pose().along).toBeLessThan(1.2);
  });

  it('flattens against a wall on a bounce, hugging it, then recovers', () => {
    const m = createMotion();
    m.bounce(1, 0, 600); // left wall, normal points right
    run(m, 0, 0, 0.05);
    const p = m.pose();
    expect(p.along).toBeLessThan(0.95);
    expect(p.shiftX).toBeLessThan(0); // pulled toward the wall so the dot keeps touching it
    run(m, 0, 0, 0.6);
    expect(Math.abs(m.pose().along - 1)).toBeLessThan(0.02);
    expect(m.pose().shiftX).toBe(0);
  });

  it('ignores non-positive frame deltas', () => {
    const m = createMotion();
    m.bounce(0, 1, 800);
    const before = m.pose();
    m.update(0, 0, 0);
    m.update(0, 0, -0.1);
    expect(m.pose()).toEqual(before);
  });
});
```

`web/tests/fx.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createFx } from '../src/render/fx';
import { createWorld } from '../src/game/sim';
import { launch } from './helpers';

function peakShake(fx: ReturnType<typeof createFx>): number {
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    const o = fx.shakeOffset();
    peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y));
  }
  return peak;
}

const death = { type: 'death' as const, x: 0, y: 0, by: 'missile' as const, hx: 5, hy: 0 };

describe('screen shake', () => {
  it('hits hard on death (about 9 world units, ~14 px at the itch size)', () => {
    const fx = createFx(false);
    fx.handle([death], createWorld());
    const peak = peakShake(fx);
    expect(peak).toBeGreaterThan(7);
    expect(peak).toBeLessThanOrEqual(9);
  });

  it('is gentle on a launch', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'launch', id: 0, x: -312, y: 0 }], createWorld());
    expect(peakShake(fx)).toBeLessThan(3);
  });

  it('settles within 0.6 s', () => {
    const fx = createFx(false);
    fx.handle([death], createWorld());
    fx.update(0.6);
    expect(peakShake(fx)).toBe(0);
  });

  it('does not shake with reduced motion', () => {
    const fx = createFx(true);
    fx.handle([death], createWorld());
    expect(peakShake(fx)).toBe(0);
  });
});

describe('effect timing', () => {
  it('never draws a negative radius, even after a negative frame delta', () => {
    const fx = createFx(false);
    const world = createWorld();
    fx.handle([{ type: 'launch', id: 0, x: -312, y: 0 }, death, { type: 'blink', id: 0, x: -312, y: 0, n: 1 }], world);
    fx.update(-0.05); // a rAF timestamp can be earlier than the clock read at startup
    const radii: number[] = [];
    const noop = () => {};
    const ctx = new Proxy(
      { arc: (_x: number, _y: number, r: number) => radii.push(r), ellipse: (_x: number, _y: number, rx: number, ry: number) => radii.push(rx, ry) },
      { get: (t, k) => (k in t ? t[k as keyof typeof t] : noop), set: () => true },
    );
    fx.draw(ctx as unknown as CanvasRenderingContext2D);
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r).toBeGreaterThanOrEqual(0);
  });
});

describe('win confetti', () => {
  it('pops each flying missile in turn', () => {
    const fx = createFx(false);
    const world = createWorld();
    launch(world, 0, -50, 0, 0);
    launch(world, 3, 50, 0, 0);
    fx.handle([{ type: 'win', x: 0, y: 0 }], world);
    expect(fx.popped(0)).toBe(false);
    fx.update(0.01);
    expect(fx.popped(0)).toBe(true);
    expect(fx.popped(3)).toBe(false);
    fx.update(0.5);
    expect(fx.popped(3)).toBe(true);
    fx.reset();
    expect(fx.popped(0)).toBe(false);
  });
});

describe('frame pulse', () => {
  it('pulses on a stage change and fades out', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'stage', stage: 2 }], createWorld());
    expect(fx.pulse()).toBeCloseTo(1);
    fx.update(1);
    expect(fx.pulse()).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/shapes.test.ts tests/trails.test.ts tests/motion.test.ts tests/fx.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the helpers**

`web/src/render/tween.ts`:
```ts
export type RGB = [number, number, number];

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolates angles the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Frame-rate independent exponential approach toward `target`. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
```

`web/src/render/shapes.ts`:
```ts
/** Adds a rounded rectangle to the current path (falls back to arcTo where roundRect is missing: Safari < 16). */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A capsule lying along +x, centred on the origin. */
export function capsulePath(ctx: CanvasRenderingContext2D, length: number, radius: number): void {
  const half = length / 2 - radius;
  ctx.moveTo(-half, -radius);
  ctx.lineTo(half, -radius);
  ctx.arc(half, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-half, radius);
  ctx.arc(-half, 0, radius, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

/** A chevron pointing along +x with its tip on the origin (stroke it). */
export function chevronPath(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.moveTo(-size * 0.5, -size * 0.6);
  ctx.lineTo(0, 0);
  ctx.lineTo(-size * 0.5, size * 0.6);
}
```

`web/src/render/trails.ts`:
```ts
export interface TrailSample {
  x: number;
  y: number;
  t: number;
}

export interface TrailSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0 at the old end, 1 at the newest point. */
  k: number;
}

/** The trail's segments younger than maxAge, oldest first. */
export function trailSegments(samples: TrailSample[], now: number, maxAge: number): TrailSegment[] {
  const out: TrailSegment[] = [];
  const from = now - maxAge;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.t < from) continue;
    out.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, k: Math.max(0, Math.min(1, (b.t - from) / maxAge)) });
  }
  return out;
}

export interface Trail {
  push(x: number, y: number, now: number): void;
  /** A tapered, fading stroke: full `width` and opacity at the head. */
  draw(ctx: CanvasRenderingContext2D, now: number, maxAge: number, width: number, color: string): void;
  clear(): void;
}

const KEEP = 1.2; // seconds of samples kept, longer than any trail drawn

export function createTrail(): Trail {
  let samples: TrailSample[] = [];
  return {
    push(x, y, now) {
      samples.push({ x, y, t: now });
      while (samples.length > 2 && samples[0].t < now - KEEP) samples.shift();
    },
    draw(ctx, now, maxAge, width, color) {
      const segs = trailSegments(samples, now, maxAge);
      if (segs.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (const s of segs) {
        ctx.globalAlpha = s.k * 0.85;
        ctx.lineWidth = Math.max(0.01, width * s.k);
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      samples = [];
    },
  };
}
```

`web/src/render/motion.ts`:
```ts
/** Squash & stretch for the dot: a damped spring on how stretched it is along its motion. */

export interface DotPose {
  /** Axis of the stretch (radians, world space). */
  angle: number;
  /** Scale along the axis (>1 stretched, <1 squashed) and across it. */
  along: number;
  across: number;
  /** Centre offset in radii, pulling a squashed dot toward the wall it hit so it keeps touching it. */
  shiftX: number;
  shiftY: number;
}

export interface DotMotion {
  update(vx: number, vy: number, dt: number): void;
  /** `nx, ny`: the wall's normal (into the arena); `speed`: impact speed. */
  bounce(nx: number, ny: number, speed: number): void;
  pose(): DotPose;
  reset(): void;
}

// Tuned for DotDodge speeds (the dot cruises at 200–900 u/s). Re-tune at real size in the browser.
const MAX_STRETCH = 0.16;
const REF_SPEED = 900;
const STIFFNESS = 380;
const DAMPING = 14; // underdamped: a squash overshoots back into a small stretch
const BOUNCE_SQUASH = 9;
const BOUNCE_REF = 600;
const ANCHOR_TIME = 0.18;
const SUBSTEP = 1 / 240;

export function createMotion(): DotMotion {
  let dirX = 1;
  let dirY = 0;
  let a = 0;
  let av = 0;
  let wallX = 0;
  let wallY = 0;
  let wallT = Infinity;

  return {
    update(vx, vy, dt) {
      if (dt <= 0) return;
      const speed = Math.hypot(vx, vy);
      if (speed > 20) {
        const k = 1 - Math.exp(-25 * dt);
        const nx = dirX + (vx / speed - dirX) * k;
        const ny = dirY + (vy / speed - dirY) * k;
        const m = Math.hypot(nx, ny) || 1;
        dirX = nx / m;
        dirY = ny / m;
      }
      const target = Math.min(speed / REF_SPEED, 1) * MAX_STRETCH;
      for (let left = dt; left > 0; left -= SUBSTEP) {
        const h = Math.min(left, SUBSTEP);
        av += (STIFFNESS * (target - a) - DAMPING * av) * h;
        a += av * h;
      }
      wallT += dt;
    },
    bounce(nx, ny, speed) {
      dirX = nx;
      dirY = ny;
      av -= BOUNCE_SQUASH * Math.min(speed / BOUNCE_REF, 1.5);
      wallX = nx;
      wallY = ny;
      wallT = 0;
    },
    pose() {
      let shiftX = 0;
      let shiftY = 0;
      if (wallT < ANCHOR_TIME && a < 0) {
        const fade = 1 - wallT / ANCHOR_TIME;
        shiftX = wallX * a * fade; // a < 0: toward the wall
        shiftY = wallY * a * fade;
      }
      return { angle: Math.atan2(dirY, dirX), along: 1 + a, across: 1 / (1 + a), shiftX, shiftY };
    },
    reset() {
      dirX = 1;
      dirY = 0;
      a = 0;
      av = 0;
      wallT = Infinity;
    },
  };
}
```

- [ ] **Step 4: Implement effects**

`web/src/render/fx.ts`:
```ts
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
          case 'death':
            shake(1);
            flashWith(RED, 0.5);
            ring(e.x, e.y, 10, 80, 0.5, INK, 4);
            burst(e.x, e.y, 14, WHITE, 'shard', [120, 320], [0.6, 1.1], [5, 9], 0, 2.5);
            burst(e.hx, e.hy, 8, WHITE, 'dot', [80, 200], [0.2, 0.4], [2, 3.5]);
            break;
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
      for (const p of particles) {
        p.life -= dt;
        const drag = Math.exp(-p.drag * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const r of rings) r.life -= dt;
      rings = rings.filter((r) => r.life > 0);
      for (const s of streaks) s.life -= dt;
      streaks = streaks.filter((s) => s.life > 0);
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
```

- [ ] **Step 5: Run the helper and fx tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Implement the renderer**

`web/src/render/renderer.ts`:
```ts
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
      ctx.translate(c.x, c.y);
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
```

- [ ] **Step 7: Add the temporary harness and look at it**

`web/index.html` (replaced in Task 9):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>DotDodge (harness)</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #ff0000; }
      #game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`web/src/main.ts` (temporary harness, replaced in Task 11):
```ts
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
```

Run: `npm run dev`, open the printed URL in the browser pane at 1024×576. Check:
- The white missile's chevron blinks three times, then the missile flies in from under the left wall and chases the dot.
- Arrow keys or WASD thrust the dot, which slides and bounces with squash and dust.
- In the console, `dd.skip(100)` jumps to stage 6: the cannons pop in, arrows slide along the top and bottom lanes, X slows time.
- Getting caught shatters the dot with a shake and a red flash.
- Resize to 390×844: the arena turns and "up" still moves the dot up the screen.

- [ ] **Step 8: Commit**

```bash
git add web/src/render web/index.html web/src/main.ts web/tests
git commit -m "web: add canvas renderer, effects, squash spring, trails and a playable harness"
```

---

### Task 9: DOM UI (screens, HUD, logo, iris), font and best record

**Files:**
- Create: `web/src/best.ts`, `web/src/ui/styles.css`, `web/src/ui/fonts/tektur.woff2`, `web/public/OFL-Tektur.txt`
- Modify: `web/src/ui/screens.ts` (from the two types to the full UI), `web/index.html` (from harness to the real page)
- Test: `web/tests/best.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `countdownShown`, `formatTime`, `stageAt`, `World`, `View`.
- Produces:
  - `createBestTracker(initial, save): BestTracker { value; startRun(); record(seconds); isNewBest(seconds) }`
  - `describeRun(seconds): string`
  - `createUI(root): UI`, where `UI` is:

```ts
interface UI {
  show(name: ScreenName): void;
  onAction(h: (a: UIAction) => void): void;
  onVolume(h: (kind: 'music' | 'sfx', value: number) => void): void;
  onHover(h: () => void): void;
  layout(v: View): void;
  hud(world: World, touch: boolean): void;
  banner(text: string): void;
  pulseTimer(): void;
  gameOver(seconds: number, best: number, isNew: boolean): void;
  setBest(best: number): void;
  setVolumes(music: number, sfx: number): void;
  setMuted(m: boolean): void;
  iris(onCovered: () => void, fast?: boolean): void;
}
```

- [ ] **Step 1: Write the failing test**

`web/tests/best.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createBestTracker, describeRun } from '../src/best';

describe('best record', () => {
  it('saves only improvements and judges a run against the best before it', () => {
    const saved: number[] = [];
    const best = createBestTracker(30, (v) => saved.push(v));
    best.startRun();
    best.record(20);
    expect(best.value).toBe(30);
    expect(best.isNewBest(20)).toBe(false);
    best.record(45);
    expect(best.value).toBe(45);
    expect(best.isNewBest(45)).toBe(true);
    expect(saved).toEqual([45]);
    best.startRun();
    expect(best.isNewBest(40)).toBe(false);
  });

  it('describes a run by time and stage, or as cleared', () => {
    expect(describeRun(0)).toBe('0:00 · Stage 1');
    expect(describeRun(83)).toBe('1:23 · Stage 5');
    expect(describeRun(120)).toBe('Cleared ★');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/best.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `best.ts`**

```ts
import { CONFIG } from './game/config';
import { formatTime, stageAt } from './game/schedule';

/** Best = the most countdown seconds survived (120 = cleared). */
export interface BestTracker {
  readonly value: number;
  /** Call when a run starts: "new best" is judged against the best from before this run. */
  startRun(): void;
  /** Saves `seconds` if it beats the best. */
  record(seconds: number): void;
  isNewBest(seconds: number): boolean;
}

export function createBestTracker(initial: number, save: (value: number) => void): BestTracker {
  let best = initial;
  let beforeRun = initial;
  return {
    get value() {
      return best;
    },
    startRun() {
      beforeRun = best;
    },
    record(seconds) {
      if (seconds <= best) return;
      best = seconds;
      save(best);
    },
    isNewBest(seconds) {
      return seconds > beforeRun;
    },
  };
}

/** "1:23 · Stage 5", or "Cleared ★" for a full run. */
export function describeRun(seconds: number): string {
  return seconds >= CONFIG.countdown ? 'Cleared ★' : `${formatTime(seconds)} · Stage ${stageAt(seconds)}`;
}
```

Run: `npx vitest run tests/best.test.ts`
Expected: PASS.

- [ ] **Step 4: Add the font and its licence**

Subset Tektur (variable, OFL) to the characters the UI uses and convert it to woff2. If pip is unavailable, copy the TTF to `src/ui/fonts/tektur.ttf` instead and use `format('truetype')` in Step 5.

```bash
cd web
FONT_TMP="$(mktemp -d)"
curl -sfL -o "$FONT_TMP/Tektur.ttf" "https://raw.githubusercontent.com/google/fonts/main/ofl/tektur/Tektur%5Bwdth,wght%5D.ttf"
mkdir -p public src/ui/fonts
curl -sfL -o public/OFL-Tektur.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/tektur/OFL.txt"
python3 -m venv "$FONT_TMP/venv" && "$FONT_TMP/venv/bin/pip" install -q fonttools brotli
"$FONT_TMP/venv/bin/pyftsubset" "$FONT_TMP/Tektur.ttf" \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+00D7,U+2019,U+2026,U+2605" \
  --layout-features='*' --flavor=woff2 --output-file=src/ui/fonts/tektur.woff2
ls -la src/ui/fonts public
```
Expected: `tektur.woff2` (tens of KB) and `OFL-Tektur.txt` exist.

- [ ] **Step 5: Write `styles.css`**

```css
@font-face {
  font-family: 'Tektur';
  src: url('./fonts/tektur.woff2') format('woff2');
  font-weight: 400 900;
  font-stretch: 75% 100%;
  font-display: block;
}

:root {
  --red: #ff0000;
  --orange: #ffad00;
  --ink: #000;
  --white: #fff;
  --font: 'Tektur', 'Arial Black', Impact, system-ui, sans-serif;
  --ease-pop: cubic-bezier(0.2, 1.4, 0.4, 1);
  /* Cartoon outline for HTML text (paint-order on HTML text is not universal yet). */
  --ol: 0 3px 0 var(--ink), 3px 0 0 var(--ink), 0 -3px 0 var(--ink), -3px 0 0 var(--ink), 2px 2px 0 var(--ink),
    -2px 2px 0 var(--ink), 2px -2px 0 var(--ink), -2px -2px 0 var(--ink);
  --ol-drop: var(--ol), 0 6px 0 var(--ink);
  /* The arena's rectangle in CSS px; ui.layout() keeps these current. */
  --ax: 12px;
  --ay: 52px;
  --aw: 1000px;
  --ah: 512px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; overflow: hidden; background: var(--red); overscroll-behavior: none; }

body {
  font-family: var(--font);
  font-weight: 900;
  font-stretch: 75%;
  color: var(--white);
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#ui { position: fixed; inset: 0; pointer-events: none; }

/* screen switching */
[data-screen] {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.22s ease, transform 0.4s var(--ease-pop), visibility 0s linear 0.4s;
}
[data-screen].is-visible { opacity: 1; visibility: visible; transition-delay: 0s; }
[data-screen].is-visible button,
[data-screen].is-visible input { pointer-events: auto; }

.screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
  text-align: center;
  transform: translateY(14px) scale(0.98);
}
.screen.is-visible { transform: none; }
.overlay { background: rgba(0, 0, 0, 0.42); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }

h1, h2 { letter-spacing: 0.02em; text-shadow: var(--ol-drop); }
h2 { font-size: clamp(40px, 8vw, 72px); line-height: 1; }

/* title */
.logo { width: clamp(110px, 24vmin, 210px); aspect-ratio: 1; }
.logo svg { width: 100%; height: 100%; overflow: visible; }
.logo .cap, .logo .dot { stroke: var(--ink); stroke-width: 4; }
.logo line { stroke: var(--ink); stroke-width: 2.5; stroke-linecap: round; }
.logo .spin { animation: spin 40s linear infinite; }
.logo .ray { animation: ray 1.8s ease-in-out infinite; animation-delay: calc(var(--i) * -0.26s); }
.title {
  font-size: clamp(56px, 12vw, 120px);
  line-height: 0.9;
  text-shadow: 0 5px 0 var(--ink), 5px 0 0 var(--ink), 0 -5px 0 var(--ink), -5px 0 0 var(--ink), 4px 4px 0 var(--ink),
    -4px 4px 0 var(--ink), 4px -4px 0 var(--ink), -4px -4px 0 var(--ink), 0 10px 0 var(--ink);
}
.screen.is-visible .logo { animation: drop 0.7s var(--ease-pop) both; }
.screen.is-visible .title { animation: drop 0.7s 0.08s var(--ease-pop) both; }
.best { font-size: 20px; min-height: 1.2em; text-shadow: var(--ol); }
.hints { list-style: none; font-size: clamp(13px, 1.8vw, 17px); font-weight: 800; line-height: 1.5; text-shadow: var(--ol); }
.hints small { font-size: 0.8em; }

/* buttons */
.menu { display: flex; flex-direction: column; gap: 14px; width: min(260px, 100%); }
.btn {
  font: inherit;
  font-size: 26px;
  letter-spacing: 0.03em;
  color: var(--ink);
  background: var(--white);
  border: 4px solid var(--ink);
  border-radius: 16px;
  padding: 8px 26px 10px;
  box-shadow: 0 6px 0 var(--ink);
  cursor: pointer;
  transition: transform 0.12s var(--ease-pop), box-shadow 0.12s ease, background-color 0.12s ease;
}
.btn:hover,
.btn:focus-visible { transform: translateY(-2px); box-shadow: 0 8px 0 var(--ink); background: #fff4d1; outline: none; }
.btn:active { transform: translateY(6px); box-shadow: 0 0 0 var(--ink); }
.btn.primary { background: var(--orange); }
.btn.primary:hover,
.btn.primary:focus-visible { background: #ffc54d; }

/* hud: everything hangs off the arena rectangle, so it never sits on the walls */
.hud { position: absolute; inset: 0; }
.hud .stage,
.hud .timer,
.hud .slowmo { position: absolute; top: 0; height: var(--ay); display: flex; align-items: center; text-shadow: var(--ol); }
.hud .stage { left: var(--ax); font-size: clamp(16px, 2.4vw, 24px); }
.hud .timer {
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(28px, 5vw, 46px);
  font-variant-numeric: tabular-nums;
  transition: color 0.2s ease;
}
/* The band is red, so "urgent" uses the yellow missile's colour rather than red. */
.hud .timer.urgent { color: #ffd900; }
.icon-btn { width: 44px; height: 44px; padding: 0; border-radius: 12px; display: grid; place-items: center; box-shadow: 0 4px 0 var(--ink); }
.pause-btn { position: absolute; top: calc((var(--ay) - 48px) / 2); left: calc(var(--ax) + var(--aw) - 44px); }
.pause-btn::before,
.pause-btn::after { content: ''; grid-area: 1 / 1; width: 6px; height: 18px; border-radius: 2px; background: var(--ink); }
.pause-btn::before { transform: translateX(-5px); }
.pause-btn::after { transform: translateX(5px); }
.hud .slowmo {
  left: calc(var(--ax) + var(--aw) - 60px);
  transform: translateX(-100%);
  gap: 10px;
  font-size: 15px;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.hud .slowmo.is-on { opacity: 1; }
.slowmo .meter {
  width: 90px;
  height: 16px;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.35);
  overflow: hidden;
  box-shadow: 0 3px 0 var(--ink);
}
.slowmo .meter > span { display: block; height: 100%; background: var(--white); transform-origin: left center; }
.slowmo.is-active .meter > span { background: #8fd3ff; }
@media (max-width: 640px) { .slowmo .label { display: none; } }
.slowmo-btn {
  position: absolute;
  left: calc(var(--ax) + var(--aw) - 92px);
  top: calc(var(--ay) + var(--ah) - 92px);
  width: 76px;
  height: 76px;
  padding: 0;
  border-radius: 50%;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.78);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.2s ease, transform 0.25s var(--ease-pop), background-color 0.12s ease;
}
.slowmo-btn.is-on { opacity: 1; transform: none; }
.slowmo-btn:not(.is-on) { pointer-events: none !important; }
.slowmo-btn.is-active { background: #8fd3ff; }
.banner {
  position: absolute;
  left: calc(var(--ax) + var(--aw) / 2);
  top: calc(var(--ay) + var(--ah) / 2);
  font-size: clamp(36px, 8vw, 80px);
  white-space: nowrap;
  text-shadow: var(--ol-drop);
  opacity: 0;
  transform: translate(-50%, -50%);
}
.banner.is-playing { animation: banner 1.3s ease both; }

/* options */
.options-list { display: grid; gap: 18px; width: min(380px, 100%); }
.slider { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 14px; font-size: 22px; text-align: left; text-shadow: var(--ol); }
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  background: var(--white);
  border: 3px solid var(--ink);
  border-radius: 10px;
  cursor: pointer;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--orange);
  border: 4px solid var(--ink);
}
input[type='range']::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: var(--orange); border: 4px solid var(--ink); }
input[type='range']:focus-visible { outline: 3px solid var(--white); outline-offset: 3px; }

/* game over */
.gotcha { font-size: clamp(56px, 12vw, 120px); transform: rotate(-4deg); }
.screen.is-visible .gotcha { animation: slam 0.45s var(--ease-pop) both; }
.run { font-size: clamp(20px, 3vw, 28px); text-shadow: var(--ol); }
.new-best {
  display: none;
  margin-left: 8px;
  padding: 2px 10px;
  color: var(--ink);
  background: var(--orange);
  border: 3px solid var(--ink);
  border-radius: 8px;
  text-shadow: none;
}
.new-best.is-on { display: inline-block; animation: pulse 0.9s ease-in-out infinite alternate; }

/* congrats */
.congrats h2 small { display: block; margin-top: 10px; font-size: 0.5em; }
.credit { font-size: 20px; text-shadow: var(--ol); }

/* iris wipe */
.iris {
  position: fixed;
  left: 50%;
  top: 50%;
  width: 300vmax;
  height: 300vmax;
  border-radius: 50%;
  background: var(--orange);
  border: 14px solid var(--ink);
  transform: translate(-50%, -50%) scale(0);
  visibility: hidden;
  pointer-events: none;
  z-index: 10;
}
.iris.is-on { visibility: visible; pointer-events: auto; }

@keyframes drop { from { opacity: 0; transform: translateY(-40px) scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes ray { 50% { transform: translateX(7px); } }
@keyframes slam { from { opacity: 0; transform: rotate(-4deg) scale(2.2); } to { opacity: 1; transform: rotate(-4deg) scale(1); } }
@keyframes pulse { to { transform: scale(1.08); } }
@keyframes banner {
  0% { opacity: 0; transform: translate(-160%, -50%) skewX(-12deg); }
  18% { opacity: 1; transform: translate(-50%, -50%) skewX(-6deg); }
  75% { opacity: 1; transform: translate(-44%, -50%) skewX(-6deg); }
  100% { opacity: 0; transform: translate(60%, -50%) skewX(-12deg); }
}

@media (max-height: 520px) {
  .screen { gap: 10px; }
  .logo { width: 84px; }
  .title { font-size: 54px; }
  .menu { flex-direction: row; justify-content: center; width: auto; }
  .btn { font-size: 20px; padding: 6px 20px 8px; }
  .hints { font-size: 12px; line-height: 1.35; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: Write the real `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ff0000" />
    <meta name="description" content="Dodge seven homing missiles for 120 seconds. Momentum, wall bounces, and one hidden key." />
    <title>DotDodge</title>
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23ffad00'/%3E%3Ccircle cx='8' cy='8' r='4' fill='%23fff' stroke='%23000' stroke-width='1.6'/%3E%3C/svg%3E"
    />
  </head>
  <body>
    <canvas id="game" aria-label="Game"></canvas>
    <div id="ui">
      <section class="screen" data-screen="title">
        <div class="logo" data-bind="logo"></div>
        <h1 class="title">DotDodge</h1>
        <div class="menu">
          <button class="btn primary" data-action="play">Play</button>
          <button class="btn" data-action="options">Options</button>
        </div>
        <p class="best" data-bind="titleBest"></p>
        <ul class="hints">
          <li>WASD / arrows / drag to dodge</li>
          <li>You win when the timer hits 0 <small>(but not impossible)</small></li>
          <li>The last bit is tricky… and there's one hidden key</li>
        </ul>
      </section>

      <section class="hud" data-screen="playing paused gameover congrats">
        <div class="stage" data-bind="stage">Stage 1</div>
        <div class="timer" data-bind="timer">120</div>
        <div class="slowmo" data-bind="slowmo">
          <span class="label">'X' for SlowMo</span>
          <span class="meter"><span data-bind="slowmoFill"></span></span>
        </div>
        <button class="btn icon-btn pause-btn" data-action="pause" aria-label="Pause"></button>
        <button class="btn slowmo-btn" data-action="slowmo" data-bind="slowmoBtn" aria-label="Slow motion">SLOW</button>
        <div class="banner" data-bind="banner"></div>
      </section>

      <section class="screen overlay" data-screen="paused">
        <h2>Paused</h2>
        <div class="menu">
          <button class="btn primary" data-action="resume">Resume</button>
          <button class="btn" data-action="restart">Restart</button>
          <button class="btn" data-action="options">Options</button>
          <button class="btn" data-action="menu">Quit</button>
        </div>
      </section>

      <section class="screen overlay" data-screen="options">
        <h2>Options</h2>
        <div class="options-list">
          <label class="slider">Music <input type="range" min="0" max="100" step="1" data-volume="music" /></label>
          <label class="slider">Sounds <input type="range" min="0" max="100" step="1" data-volume="sfx" /></label>
        </div>
        <div class="menu">
          <button class="btn" data-action="toggleMute" aria-pressed="false">Sound: on</button>
          <button class="btn primary" data-action="back">Back</button>
        </div>
      </section>

      <section class="screen overlay" data-screen="gameover">
        <h2 class="gotcha">GOTCHA!</h2>
        <p class="run" data-bind="goRun"></p>
        <p class="best"><span data-bind="goBest"></span><b class="new-best" data-bind="goNew">New best!</b></p>
        <div class="menu">
          <button class="btn primary" data-action="restart">Retry</button>
          <button class="btn" data-action="menu">Menu</button>
        </div>
      </section>

      <section class="screen overlay congrats" data-screen="congrats">
        <h2>Congrats!<small>You're a Legend</small></h2>
        <p class="credit">By ahamsel</p>
        <div class="menu">
          <button class="btn primary" data-action="restart">Play again</button>
          <button class="btn" data-action="menu">Menu</button>
        </div>
      </section>

      <div class="iris" data-bind="iris"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Write the full `screens.ts`** (replacing the two-type stub; keep both exported types)

```ts
import { describeRun } from '../best';
import { CONFIG } from '../game/config';
import { countdownShown } from '../game/schedule';
import type { World } from '../game/types';
import type { View } from '../render/view';

export type ScreenName = 'title' | 'options' | 'playing' | 'paused' | 'gameover' | 'congrats';
export type UIAction = 'play' | 'options' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'slowmo' | 'toggleMute';

export interface UI {
  show(name: ScreenName): void;
  onAction(handler: (action: UIAction) => void): void;
  onVolume(handler: (kind: 'music' | 'sfx', value: number) => void): void;
  onHover(handler: () => void): void;
  /** Publishes the arena rectangle so the HUD hangs off it. */
  layout(view: View): void;
  hud(world: World, touch: boolean): void;
  banner(text: string): void;
  pulseTimer(): void;
  gameOver(seconds: number, best: number, isNew: boolean): void;
  setBest(best: number): void;
  setVolumes(music: number, sfx: number): void;
  setMuted(muted: boolean): void;
  /** Closes an iris over the screen, calls `onCovered`, then opens it again. */
  iris(onCovered: () => void, fast?: boolean): void;
}

const POP: Keyframe[] = [{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }];

/** The 2020 start-screen "sun": the dot with the seven missiles flying outward. */
function logoSvg(): string {
  const rays = CONFIG.missiles
    .map((m, i) => {
      const a = (-90 + (i * 360) / CONFIG.missiles.length).toFixed(1);
      return (
        `<g transform="rotate(${a})"><g class="ray" style="--i:${i}">` +
        `<line x1="24" y1="-4" x2="31" y2="-4"/><line x1="20" y1="0" x2="31" y2="0"/><line x1="25" y1="4" x2="31" y2="4"/>` +
        `<rect class="cap" x="36" y="-6" width="28" height="12" rx="6" fill="${m.color}"/></g></g>`
      );
    })
    .join('');
  return `<svg viewBox="-80 -80 160 160" aria-hidden="true"><g class="spin">${rays}<circle class="dot" r="17" fill="#fff"/></g></svg>`;
}

export function createUI(root: HTMLElement): UI {
  const bind = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-bind="${name}"]`);
    if (!el) throw new Error(`missing [data-bind="${name}"]`);
    return el;
  };
  const screens = Array.from(root.querySelectorAll<HTMLElement>('[data-screen]'));
  const timer = bind('timer');
  const stage = bind('stage');
  const slowmo = bind('slowmo');
  const slowmoFill = bind('slowmoFill');
  const slowmoBtn = bind('slowmoBtn');
  const banner = bind('banner');
  const titleBest = bind('titleBest');
  const goRun = bind('goRun');
  const goBest = bind('goBest');
  const goNew = bind('goNew');
  const iris = bind('iris');
  const music = root.querySelector<HTMLInputElement>('input[data-volume="music"]')!;
  const sfx = root.querySelector<HTMLInputElement>('input[data-volume="sfx"]')!;
  const muteBtn = root.querySelector<HTMLElement>('[data-action="toggleMute"]')!;
  bind('logo').innerHTML = logoSvg();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let onAction: (action: UIAction) => void = () => {};
  let onVolume: (kind: 'music' | 'sfx', value: number) => void = () => {};
  let onHover: () => void = () => {};

  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    btn.blur();
    onAction(btn.dataset.action as UIAction);
  });
  let hovered: Element | null = null;
  root.addEventListener('pointerover', (e) => {
    const btn = (e.target as Element).closest('button');
    if (btn && btn !== hovered && e.pointerType === 'mouse') onHover();
    hovered = btn;
  });
  for (const input of [music, sfx]) {
    input.addEventListener('input', () => onVolume(input.dataset.volume as 'music' | 'sfx', Number(input.value) / 100));
  }

  const shown = { timer: -1, urgent: false, stage: 0, unlocked: false, btn: false, active: false, meter: -1 };
  let irisBusy = false;

  return {
    show(name) {
      for (const el of screens) el.classList.toggle('is-visible', el.dataset.screen!.split(' ').includes(name));
    },

    onAction(h) {
      onAction = h;
    },
    onVolume(h) {
      onVolume = h;
    },
    onHover(h) {
      onHover = h;
    },

    layout(v) {
      const s = root.style;
      s.setProperty('--ax', `${v.x}px`);
      s.setProperty('--ay', `${v.y}px`);
      s.setProperty('--aw', `${v.w}px`);
      s.setProperty('--ah', `${v.h}px`);
    },

    hud(world, touch) {
      const n = countdownShown(world.elapsed);
      if (n !== shown.timer) {
        timer.textContent = String(n);
        shown.timer = n;
      }
      const urgent = n <= 10 && world.phase === 'running';
      if (urgent !== shown.urgent) {
        timer.classList.toggle('urgent', urgent);
        shown.urgent = urgent;
      }
      if (world.stage !== shown.stage) {
        stage.textContent = `Stage ${world.stage}`;
        shown.stage = world.stage;
      }
      const unlocked = world.stage >= 6 && world.phase === 'running';
      if (unlocked !== shown.unlocked) {
        slowmo.classList.toggle('is-on', unlocked);
        shown.unlocked = unlocked;
      }
      const btn = unlocked && touch;
      if (btn !== shown.btn) {
        slowmoBtn.classList.toggle('is-on', btn);
        shown.btn = btn;
      }
      const active = world.slowmo.active;
      if (active !== shown.active) {
        slowmo.classList.toggle('is-active', active);
        slowmoBtn.classList.toggle('is-active', active);
        shown.active = active;
      }
      const meter = Math.round((world.slowmo.meter / CONFIG.slowmo.capacity) * 100) / 100;
      if (meter !== shown.meter) {
        slowmoFill.style.transform = `scaleX(${meter})`;
        shown.meter = meter;
      }
    },

    banner(text) {
      banner.textContent = text;
      banner.classList.remove('is-playing');
      void banner.offsetWidth; // restart the animation
      banner.classList.add('is-playing');
    },

    pulseTimer() {
      timer.animate?.(POP, { duration: 260, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    },

    gameOver(seconds, best, isNew) {
      goRun.textContent = `Survived ${describeRun(seconds)}`;
      goBest.textContent = `Best ${describeRun(best)}`;
      goNew.classList.toggle('is-on', isNew);
    },

    setBest(best) {
      titleBest.textContent = best <= 0 ? '' : best >= CONFIG.countdown ? describeRun(best) : `Best ${describeRun(best)}`;
    },

    setVolumes(m, s) {
      music.value = String(Math.round(m * 100));
      sfx.value = String(Math.round(s * 100));
    },

    setMuted(m) {
      muteBtn.textContent = m ? 'Sound: off' : 'Sound: on';
      muteBtn.setAttribute('aria-pressed', String(m));
    },

    iris(onCovered, fast = false) {
      if (irisBusy || typeof iris.animate !== 'function') {
        onCovered();
        return;
      }
      irisBusy = true;
      iris.classList.add('is-on');
      const frames: Keyframe[] = reduced
        ? [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }]
        : [{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }];
      const close = iris.animate(frames, { duration: fast ? 220 : 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      close.onfinish = () => {
        onCovered();
        const open = iris.animate([...frames].reverse(), {
          duration: fast ? 260 : 440,
          delay: 60,
          easing: 'cubic-bezier(.25,1,.5,1)',
          fill: 'forwards',
        });
        open.onfinish = () => {
          iris.classList.remove('is-on');
          irisBusy = false;
        };
      };
    },
  };
}
```

- [ ] **Step 8: Type-check and test**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. The harness `main.ts` still runs because it only needs the canvas, which the new `index.html` keeps.

- [ ] **Step 9: Commit**

```bash
git add web/src/best.ts web/src/ui web/public web/index.html web/tests/best.test.ts
git commit -m "web: add cartoon DOM screens, HUD, sun logo, iris wipe, Tektur font and best record"
```

---

### Task 10: Synthesised sound and music

**Files:**
- Create: `web/src/audio/engine.ts`, `web/src/audio/sfx.ts`, `web/src/audio/music.ts`, `web/src/audio/events.ts`
- Test: `web/tests/audio.test.ts`

**Interfaces:**
- Consumes: `SimEvent`.
- Produces:
  - `createAudioEngine(): AudioEngine { unlock(); ctx(); musicBus(); sfxBus(); setVolumes(music, sfx); setMuted(m); onUnlock(cb) }`
  - `createSfx(engine): Sfx { play(name: SfxName, variant?) }`
  - `createMusic(engine): Music { start(); stop(); setStage(n); setSlow(on); setDucked(on) }`
  - `layersFor(stage)`, `midiToHz(n)`
  - `soundForEvent(e): [SfxName, number] | null`

- [ ] **Step 1: Write the failing test**

`web/tests/audio.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createAudioEngine } from '../src/audio/engine';
import { soundForEvent } from '../src/audio/events';
import { createMusic, layersFor, midiToHz } from '../src/audio/music';
import { createSfx } from '../src/audio/sfx';

describe('event sounds', () => {
  it('maps sim events to sounds', () => {
    expect(soundForEvent({ type: 'blink', id: 0, x: 0, y: 0, n: 2 })).toEqual(['blink', 2]);
    expect(soundForEvent({ type: 'launch', id: 0, x: 0, y: 0 })).toEqual(['launch', 0]);
    expect(soundForEvent({ type: 'bounce', x: 0, y: 0, nx: 1, ny: 0, speed: 432 })).toEqual(['bounce', 432]);
    expect(soundForEvent({ type: 'nearMiss', id: 1, x: 0, y: 0, angle: 0 })).toEqual(['whoosh', 0]);
    expect(soundForEvent({ type: 'slowmo', on: true })).toEqual(['slowIn', 0]);
    expect(soundForEvent({ type: 'slowmo', on: false })).toEqual(['slowOut', 0]);
    expect(soundForEvent({ type: 'tick', remaining: 3 })).toEqual(['tick', 3]);
    expect(soundForEvent({ type: 'death', x: 0, y: 0, by: 'arrow', hx: 0, hy: 0 })).toEqual(['gotcha', 0]);
    expect(soundForEvent({ type: 'win', x: 0, y: 0 })).toEqual(['fanfare', 0]);
    expect(soundForEvent({ type: 'warn', id: 0, x: 0, y: 0 })).toBeNull();
  });
});

describe('music', () => {
  it('adds layers as the stages rise', () => {
    expect(layersFor(1)).toEqual({ bass: true, drums: true, arp: false, lead: false, fastHats: false });
    expect(layersFor(3).arp).toBe(true);
    expect(layersFor(5).lead).toBe(true);
    expect(layersFor(6).fastHats).toBe(true);
  });

  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
});

describe('without WebAudio', () => {
  it('stays silent instead of throwing', () => {
    const engine = createAudioEngine();
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.ctx()).toBeNull();
    const sfx = createSfx(engine);
    const music = createMusic(engine);
    expect(() => {
      sfx.play('gotcha');
      music.start();
      music.setStage(6);
      music.setSlow(true);
      music.setDucked(true);
      music.stop();
      engine.setVolumes(0.5, 0.5);
      engine.setMuted(true);
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`web/src/audio/engine.ts`:
```ts
export interface AudioEngine {
  /** Call from a user gesture: browsers only allow audio after one. */
  unlock(): void;
  ctx(): AudioContext | null;
  musicBus(): GainNode | null;
  sfxBus(): GainNode | null;
  /** 0..1 slider values (applied on a perceptual curve). */
  setVolumes(music: number, sfx: number): void;
  setMuted(muted: boolean): void;
  /** Runs `cb` once audio exists (immediately if it already does). */
  onUnlock(cb: () => void): void;
}

const MASTER = 0.8;

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfx: GainNode | null = null;
  let failed = false;
  let muted = false;
  let vol = { music: 0.6, sfx: 0.8 };
  const waiting: (() => void)[] = [];
  const curve = (v: number) => v * v;

  return {
    unlock() {
      if (!ctx && !failed) {
        try {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : MASTER;
          master.connect(ctx.destination);
          music = ctx.createGain();
          music.gain.value = curve(vol.music);
          music.connect(master);
          sfx = ctx.createGain();
          sfx.gain.value = curve(vol.sfx);
          sfx.connect(master);
        } catch {
          ctx = null; // no audio support: everything stays silent
          failed = true;
          return;
        }
        for (const cb of waiting.splice(0)) cb();
      }
      // 'suspended' before the first gesture; iOS can also leave it 'interrupted' after a call or app switch.
      if (ctx && ctx.state !== 'running') void ctx.resume?.();
    },
    ctx: () => ctx,
    musicBus: () => music,
    sfxBus: () => sfx,
    setVolumes(m, s) {
      vol = { music: m, sfx: s };
      if (ctx && music && sfx) {
        music.gain.setTargetAtTime(curve(m), ctx.currentTime, 0.02);
        sfx.gain.setTargetAtTime(curve(s), ctx.currentTime, 0.02);
      }
    },
    setMuted(m) {
      muted = m;
      if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, 0.02);
    },
    onUnlock(cb) {
      if (ctx) cb();
      else waiting.push(cb);
    },
  };
}
```

`web/src/audio/sfx.ts`:
```ts
import type { AudioEngine } from './engine';

export type SfxName =
  | 'bounce'
  | 'blink'
  | 'launch'
  | 'whoosh'
  | 'stage'
  | 'tick'
  | 'gotcha'
  | 'fanfare'
  | 'slowIn'
  | 'slowOut'
  | 'cannon'
  | 'hover'
  | 'click';

export interface Sfx {
  play(name: SfxName, variant?: number): void;
}

/** Minimum seconds between plays, so held walls and cannon volleys don't turn into noise. */
const MIN_GAP: Partial<Record<SfxName, number>> = { bounce: 0.06, whoosh: 0.15, cannon: 0.12, hover: 0.05, blink: 0.05 };

export function createSfx(engine: AudioEngine): Sfx {
  const lastPlayed = new Map<SfxName, number>();
  let noiseBuf: AudioBuffer | null = null;

  function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(ctx: AudioContext, out: AudioNode, dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass', delay = 0) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    play(name, variant = 0) {
      const ctx = engine.ctx();
      const out = engine.sfxBus();
      if (!ctx || !out) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name];
      if (gap !== undefined && now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
      lastPlayed.set(name, now);
      switch (name) {
        case 'bounce': {
          const k = Math.min(variant / 900, 1); // variant = impact speed
          tone(ctx, out, 'sine', 120 + 200 * k, 55, 0.12, 0.08 + 0.12 * k);
          tone(ctx, out, 'triangle', 400 + 300 * k, 200, 0.05, 0.03);
          break;
        }
        case 'blink': {
          const f = 880 * (1 + (Math.max(1, variant) - 1) * 0.06);
          tone(ctx, out, 'square', f, f, 0.06, 0.05);
          break;
        }
        case 'launch':
          noise(ctx, out, 0.35, 0.18, 300, 2500);
          tone(ctx, out, 'sawtooth', 160, 520, 0.25, 0.04);
          break;
        case 'whoosh':
          noise(ctx, out, 0.25, 0.14, 2600, 500);
          break;
        case 'stage':
          [523, 659, 784, 1047].forEach((f, i) => tone(ctx, out, 'triangle', f, f, 0.09, 0.07, i * 0.07));
          break;
        case 'tick': {
          const f = variant > 0 && variant <= 3 ? 1320 : 1000;
          tone(ctx, out, 'square', f, f, 0.05, 0.06);
          break;
        }
        case 'gotcha':
          tone(ctx, out, 'square', 620, 90, 0.35, 0.12);
          tone(ctx, out, 'sawtooth', 310, 45, 0.5, 0.07);
          noise(ctx, out, 0.25, 0.15, 3000, 200, 'lowpass');
          break;
        case 'fanfare':
          for (const [f, at] of [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [784, 0.5], [1047, 0.6]] as const) {
            tone(ctx, out, 'triangle', f, f, 0.18, 0.09, at);
            tone(ctx, out, 'square', f / 2, f / 2, 0.16, 0.03, at);
          }
          break;
        case 'slowIn':
          tone(ctx, out, 'sine', 320, 70, 0.5, 0.14);
          noise(ctx, out, 0.4, 0.06, 1200, 150, 'lowpass');
          break;
        case 'slowOut':
          tone(ctx, out, 'sine', 70, 320, 0.4, 0.12);
          break;
        case 'cannon':
          noise(ctx, out, 0.06, 0.05, 1800, 300, 'lowpass');
          tone(ctx, out, 'triangle', 220, 90, 0.06, 0.03);
          break;
        case 'hover':
          tone(ctx, out, 'sine', 1100, 1300, 0.035, 0.025);
          break;
        case 'click':
          tone(ctx, out, 'triangle', 720, 480, 0.06, 0.07);
          break;
      }
    },
  };
}
```

`web/src/audio/music.ts`:
```ts
import type { AudioEngine } from './engine';

export interface Layers {
  bass: boolean;
  drums: boolean;
  arp: boolean;
  lead: boolean;
  fastHats: boolean;
}

export interface Music {
  start(): void;
  stop(): void;
  setStage(stage: number): void;
  /** Slow-mo: half tempo, pitched down, muffled. */
  setSlow(on: boolean): void;
  /** Paused: quieter. */
  setDucked(on: boolean): void;
}

export function layersFor(stage: number): Layers {
  return { bass: true, drums: true, arp: stage >= 3, lead: stage >= 5, fastHats: stage >= 6 };
}

export const midiToHz = (n: number): number => 440 * 2 ** ((n - 69) / 12);

const BPM = 140;
const STEPS = 16; // sixteenths per bar
const LOOKAHEAD = 0.12;
/** Am – F – C – G, one bar each. */
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
/** Eighth-note lead, eight per bar (0 = rest). */
const LEAD = [
  69, 72, 76, 72, 74, 72, 69, 0,
  65, 69, 72, 69, 71, 69, 65, 0,
  67, 72, 76, 79, 76, 72, 67, 0,
  67, 71, 74, 71, 74, 76, 79, 0,
];

export function createMusic(engine: AudioEngine): Music {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stepIndex = 0;
  let nextTime = 0;
  let layers = layersFor(1);
  let slow = false;
  let filter: BiquadFilterNode | null = null;
  let duck: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;

  function nodes(ctx: AudioContext): AudioNode | null {
    const bus = engine.musicBus();
    if (!bus) return null;
    if (!filter || !duck) {
      duck = ctx.createGain();
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 18000;
      filter.connect(duck).connect(bus);
    }
    return filter;
  }

  function note(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function kick(ctx: AudioContext, out: AudioNode, t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  function hiss(ctx: AudioContext, out: AudioNode, t: number, dur: number, vol: number, highpass: number) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp).connect(gain).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function schedule(ctx: AudioContext) {
    const out = nodes(ctx);
    if (!out) return;
    const stepDur = (60 / BPM / 4) * (slow ? 2 : 1);
    const pitch = slow ? 0.75 : 1;
    // A throttled background timer falls behind: skip ahead rather than firing a burst of late notes.
    if (nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.02;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const bar = Math.floor(stepIndex / STEPS) % CHORDS.length;
      const s = stepIndex % STEPS;
      const chord = CHORDS[bar];
      const t = nextTime;
      if (layers.bass && s % 2 === 0) {
        const n = chord[0] - 12 + (s % 8 === 6 ? 12 : 0);
        note(ctx, out, 'square', midiToHz(n) * pitch, t, stepDur * 1.6, 0.05);
      }
      if (layers.drums) {
        if (s === 0 || s === 8 || s === 10) kick(ctx, out, t);
        if (s === 4 || s === 12) hiss(ctx, out, t, 0.12, 0.08, 1500);
        if (s % 2 === 0 || layers.fastHats) hiss(ctx, out, t, 0.03, 0.025, 7000);
      }
      if (layers.arp) note(ctx, out, 'triangle', midiToHz(chord[s % 3] + 12) * pitch, t, stepDur * 0.9, 0.03);
      if (layers.lead && s % 2 === 0) {
        const n = LEAD[bar * 8 + s / 2];
        if (n) note(ctx, out, 'square', midiToHz(n) * pitch, t, stepDur * 1.8, 0.035);
      }
      nextTime += stepDur;
      stepIndex++;
    }
  }

  return {
    start() {
      const ctx = engine.ctx();
      if (!ctx || timer) return;
      stepIndex = 0;
      nextTime = ctx.currentTime + 0.05;
      schedule(ctx);
      timer = setInterval(() => schedule(ctx), 25);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setStage(stage) {
      layers = layersFor(stage);
    },
    setSlow(on) {
      slow = on;
      const ctx = engine.ctx();
      if (ctx && filter) filter.frequency.setTargetAtTime(on ? 700 : 18000, ctx.currentTime, 0.08);
    },
    setDucked(on) {
      const ctx = engine.ctx();
      if (ctx && duck) duck.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.1);
    },
  };
}
```

`web/src/audio/events.ts`:
```ts
import type { SimEvent } from '../game/types';
import type { SfxName } from './sfx';

/** Which sound (and variant) a sim event makes, or null for silence. */
export function soundForEvent(e: SimEvent): [SfxName, number] | null {
  switch (e.type) {
    case 'blink':
      return ['blink', e.n];
    case 'launch':
      return ['launch', 0];
    case 'stage':
      return ['stage', 0];
    case 'bounce':
      return ['bounce', e.speed];
    case 'nearMiss':
      return ['whoosh', 0];
    case 'fire':
      return ['cannon', 0];
    case 'slowmo':
      return [e.on ? 'slowIn' : 'slowOut', 0];
    case 'tick':
      return ['tick', e.remaining];
    case 'death':
      return ['gotcha', 0];
    case 'win':
      return ['fanfare', 0];
    case 'warn':
      return null;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/audio web/tests/audio.test.ts
git commit -m "web: add synthesised sound effects and a layered chiptune loop"
```

---

### Task 11: Wire everything in `main.ts` and play-test

**Files:**
- Modify: `web/src/main.ts` (replace the harness)

**Interfaces:**
- Consumes: everything above.
- Produces: the playable game. In dev builds only, `window.dd = { world(), skip(seconds) }` for testing late stages.

- [ ] **Step 1: Replace `main.ts`**

```ts
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
import { shortcutFor } from './input/shortcuts';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';
import { screenDirToWorld } from './render/view';
import { readBool, readNumber, writeBool, writeNumber } from './storage';
import { createUI, type ScreenName, type UIAction } from './ui/screens';

const ZERO: Vec = { x: 0, y: 0 };
/** A catch freezes the world for a moment so it lands with weight. */
const HIT_STOP = 0.08;
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
  if (world) best.record(world.elapsed);
}

function newRun() {
  recordRun();
  world = createWorld();
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
  if (screen === 'playing') setScreen('paused');
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
  if (document.hidden) pause();
});

audio.setVolumes(musicVol, sfxVol);
audio.setMuted(muted);
ui.setVolumes(musicVol, sfxVol);
ui.setMuted(muted);
ui.setBest(best.value);
ui.layout(renderer.view());
setScreen('title');
requestAnimationFrame(frame);
```

- [ ] **Step 2: Type-check, test, build**

Run: `npx vitest run && npm run build`
Expected: all tests pass; `dist/` contains `index.html` with relative `./assets/...` URLs, plus `OFL-Tektur.txt`.

- [ ] **Step 3: Play-test on desktop (1024×576)**

Run `npm run dev` and open it in the browser pane at 1024×576. Check, fixing anything that fails before moving on:
- The title shows the breathing sun logo, the outlined Tektur title, Play and Options, and the hints. Music starts on the first click or key.
- Play closes and opens the iris. "Stage 1", the white chevron blinks 3 times with ticks, the missile bursts in, and the countdown starts at 120 when it launches.
- Thrust feels slidey. Wall bounces squash the dot against the wall at real size (re-tune `motion.ts` constants if the squash is invisible or excessive at ~30 px), with dust and a thump.
- In the dev console, `dd.skip(14)` brings the red warning and the "Stage 2" banner. `dd.skip(80)` gets to stage 6: the cannons pop in, arrows slide along the lanes, "'X' for SlowMo" and the meter appear, X slows everything with the vignette and muffled music, and the meter drains and refills.
- Getting caught gives a hit-stop, shards, shake, "Gotcha", the missiles coasting off, then the GOTCHA! screen with the run line and best. R and Enter retry instantly.
- Run `dd.skip(200)` while dodging to reach the win: the missiles pop into confetti, the fanfare plays, and the iris opens on Congrats with "By ahamsel".
- Esc pauses (music ducks) and Esc resumes. Options sliders change the volume live and survive a reload. M mutes.
- Clicking another window auto-pauses. Arrow keys and Space don't scroll the page. Cmd+R reloads instead of restarting.
- The HUD (stage, timer, meter, pause) sits in the red band, clear of the arena outline.

- [ ] **Step 4: Play-test on phone sizes and in an iframe**

- Landscape phone 844×390 (mobile emulation, touch): the HUD fits the band, the title screen fits (row menu), and drag-to-thrust works anywhere on the arena. Tapping Pause doesn't thrust. The SLOW button appears at stage 6 and works.
- Portrait phone 390×844: the arena turns, dragging up moves the dot up the screen, and the banner and slow button sit inside the turned arena.
- Embed check: create a scratch HTML page in the scratchpad (not committed) that loads `http://localhost:5173/` in a 1024×576 `<iframe>` inside a tall scrolling page. Arrow keys and Space must not scroll the outer page while the game is focused, and blur/visibility pauses still work.
- Console: no errors or warnings during a full run.

- [ ] **Step 5: Commit**

```bash
git add web/src/main.ts
git commit -m "web: wire game loop, screens, input, audio and effects together"
```

(Commit any tuning fixes from the play-test separately, with messages that say what changed and why.)

---

### Task 12: itch packaging, store art and README

**Files:**
- Create: `web/scripts/zip-itch.mjs`, `web/tools/vite.config.ts`, `web/tools/shots.html`, `web/tools/shots.ts`, `web/marketing/*.png`
- Create: `README.md` (repo root)

**Interfaces:**
- Consumes: the real sim, renderer and fx.
- Produces: `npm run itch` → `web/dotdodge.zip`; `web/marketing/cover.png` (1260×1000) and 4–5 screenshots.

- [ ] **Step 1: Zip script**

`web/scripts/zip-itch.mjs`:
```js
// Zips dist/ into dotdodge.zip for upload to itch.io as an HTML5 game (index.html at the zip root).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'dotdodge.zip');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`Wrote ${out}`);
```

Run: `npm run itch && unzip -l dotdodge.zip`
Expected: `index.html`, `OFL-Tektur.txt` and `assets/...` at the zip root, with no `dist/` prefix.

Then check the zip build from a subfolder: `cd "$(mktemp -d)" && unzip -q <path>/web/dotdodge.zip && python3 -m http.server 5302`. Open `http://localhost:5302/`; the game must load with the font and no 404s.

- [ ] **Step 2: Store-art generator** (dev-only; renders with the game's real sim and renderer)

`web/tools/vite.config.ts`:
```ts
// Dev-only server for generating store art with the game's own renderer.
// Run: npx vite --config tools/vite.config.ts, then open /tools/shots.html. PNGs land in web/marketing/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'marketing');

export default defineConfig({
  root: join(dirname(fileURLToPath(import.meta.url)), '..'),
  server: { port: 5199, strictPort: true },
  plugins: [
    {
      name: 'save-shots',
      configureServer(server) {
        server.middlewares.use('/__save', (req, res) => {
          const name = basename(new URL(req.url ?? '', 'http://local').searchParams.get('name') ?? 'shot.png');
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            mkdirSync(outDir, { recursive: true });
            writeFileSync(join(outDir, name), Buffer.concat(chunks));
            res.end('saved ' + name);
          });
        });
      },
    },
  ],
});
```

`web/tools/shots.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Store art</title>
    <style>
      body { margin: 0; background: #222; color: #fff; font: 14px system-ui; }
      canvas { display: block; margin: 12px; }
    </style>
  </head>
  <body>
    <div id="log"></div>
    <script type="module" src="./shots.ts"></script>
  </body>
</html>
```

`web/tools/shots.ts`:
```ts
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
  ctx.font = `900 ${size}px Tektur`;
  ctx.fontStretch = 'condensed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = size * 0.16;
  ctx.fillStyle = '#000';
  ctx.fillText(text, cx, cy + size * 0.09); // drop shadow
  ctx.strokeText(text, cx, cy + size * 0.09);
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, cx, cy);
}

async function save(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  const res = await fetch(`/__save?name=${name}`, { method: 'POST', body: blob });
  log(`${await res.text()} (${canvas.width}×${canvas.height})`);
}

async function cover() {
  const W = 630;
  const H = 500;
  const s = stage(W, H);
  const p = s.world.player;
  p.x = p.px = 70;
  p.y = p.py = -40;
  // Missiles curling in on the dot from all sides (they steer during settle(), so trails curve).
  fly(s.world, 0, -230, -10, 0.2);
  fly(s.world, 1, 40, 120, -1.2);
  fly(s.world, 2, 260, 60, 3.6);
  fly(s.world, 3, -60, -130, 0.5);
  fly(s.world, 5, -200, 110, -0.4);
  settle(s, 0.18);
  outlinedText(s.canvas, 'DotDodge', W / 2, 92, 92);
  await save(s.canvas, 'cover.png');
}

async function main() {
  await document.fonts.load('900 92px Tektur');
  await cover();
  log('done');
}
void main();
```

Run: `npx vite --config tools/vite.config.ts`, open `http://localhost:5199/tools/shots.html` in the browser pane, and look at `web/marketing/cover.png` (1260×1000). Adjust the staging (positions, settle time) until the cover reads well at thumbnail size: title legible, dot clear of missiles, trails visible. A missile must never overlap the dot.

- [ ] **Step 3: Screenshots from real play**

With `npm run dev` running, use the Playwright MCP browser at 1280×720 to capture real gameplay into `web/marketing/`:
1. `shot-1-title.png`: the title screen.
2. `shot-2-chase.png`: stage 2–3, with two or three missiles chasing and trails.
3. `shot-3-spikes.png`: stage 6, cannons firing and arrow lanes filling (use `dd.skip`).
4. `shot-4-slowmo.png`: slow-mo active at stage 6.
5. `shot-5-congrats.png`: the Congrats screen.

Each must show the real HUD. Retake until no frame has a missile overlapping the dot.

- [ ] **Step 4: README**

Create `README.md` at the repo root:
```markdown
# DotDodge

My first game (2020): dodge seven homing missiles for 120 seconds.

### [Play it on itch.io](https://ahamsel.itch.io/dotdodge)

## Web version (2026)

A rebuild for the browser in `web/` (TypeScript, Canvas 2D, Vite; no runtime dependencies). Same game, same missiles and timings, redrawn with crisp shapes and with sound synthesised in the browser.

    cd web
    npm install
    npm run dev     # play locally
    npm test        # unit tests
    npm run itch    # build web/dotdodge.zip for itch.io

Controls: WASD / arrows to thrust (or drag on touch screens), Esc pause, R restart, M mute. One more key unlocks late in the run.

The font is [Tektur](https://fonts.google.com/specimen/Tektur) (SIL Open Font License, see `web/public/OFL-Tektur.txt`).

## Original Unity version (2020)

The Unity 2019.4 project is in this repo (`Assets/`, `ProjectSettings/`); the Android port lives in `ahamSel/dtddge-android`.
```

- [ ] **Step 5: Commit**

```bash
git add web/scripts web/tools web/marketing README.md
git commit -m "web: add itch.io packaging, store art generator, cover and screenshots, README"
```

---

### Task 13: Final review and ship

Not code. The steps and gates the spec requires.

- [ ] **Step 1: Fresh final review.** Dispatch a reviewer on the most capable available model over the whole branch (`git diff main...HEAD -- web README.md`), with the spec and this plan. Ask for findings graded by what a player would actually notice (game-breaking → noticeable → polish → invisible). Fix what a player would notice, re-run `npm test && npm run build`, and commit.
- [ ] **Step 2: Ask the user before pushing.** Show the commit list and ask for permission to merge the branch into `main` and push to `ahamSel/dtddge`. Do it only on a yes.
- [ ] **Step 3: Update itch via Edge (Claude browser extension).** Follow the spec's Shipping section and the user's lessons:
  - Upload `web/dotdodge.zip`. Intercept file inputs (override `HTMLInputElement.prototype.click`, move itch's hidden image inputs into `document.body`, then attach files with the upload tool).
  - Mark the zip "This file will be played in the browser". Hide the old Unity build; never delete it.
  - Never click controls labelled only "…".
  - Embed 1024×576, fullscreen button on, mobile friendly on.
  - Upload the cover and screenshots, and replace the description (draft it first and show it to the user).
  - AI disclosure: Code, Text & Dialog.
  - Show the user every pending change before clicking Save.
- [ ] **Step 4: Verify live.** Open `https://ahamsel.itch.io/dotdodge`, run the game in the embed and in fullscreen, and confirm the new build, cover, screenshots and description are all live.
