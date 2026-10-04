// Plans a real, full DotDodge run for the README preview: the actual sim, no cheats, searched ahead so the dot
// survives to the win. Open /tools/capture/plan.html on the tools server; it saves tools/capture/<name>.json,
// which the game replays with ?replay=<name> (dev only).
import { CONFIG } from '../../src/game/config';
import { gapToPlayer } from '../../src/game/missile';
import { createWorld, drainEvents, step } from '../../src/game/sim';
import type { StepInput, World } from '../../src/game/types';
import { encodeDir, REPLAY_DIRS, replayInput } from '../../src/dev/replay';

const params = new URLSearchParams(location.search);
const NAME = params.get('name') ?? 'run';
/** Countdown-elapsed second at which slow-mo is switched on once (stage 6), for the show. */
const SLOWMO_AT = Number(params.get('slowmo') ?? 104);
const SEED = Number(params.get('seed') ?? 1);

const CHUNK = 6; // steps per decision (0.1 s)
const HORIZON = 14; // chunks looked ahead
const ROLLOUTS = 6;
const { radius } = CONFIG.player;
const HW = CONFIG.arena.hw;
const HH = CONFIG.arena.hh;

const log = (msg: string) => document.getElementById('log')!.insertAdjacentHTML('beforeend', `<div>${msg}</div>`);

let seed = SEED >>> 0;
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

type Sim = { w: World; slowUsed: boolean };
const clone = (s: Sim): Sim => ({ w: structuredClone(s.w), slowUsed: s.slowUsed });
const dirInput = (dir: number): StepInput => replayInput({ dirs: encodeDir(dir), slowmo: -1 }, 0);

/** One sim step with `dir`; switches slow-mo on the first time stage 6 passes SLOWMO_AT. Returns true if it fired. */
function advance(s: Sim, dir: number): boolean {
  const input = dirInput(dir);
  let fired = false;
  if (!s.slowUsed && s.w.phase === 'running' && s.w.elapsed >= SLOWMO_AT) {
    input.slowmo = true;
    s.slowUsed = fired = true;
  }
  step(s.w, input, CONFIG.step);
  drainEvents(s.w);
  return fired;
}

/** How safe the dot is right now: distance to the nearest missile or spike, softly including the walls. */
function clearance(w: World): number {
  const p = w.player;
  let c = 200;
  for (const m of w.missiles) if (m.state === 'flying') c = Math.min(c, gapToPlayer(m, p));
  for (const a of w.arrows) c = Math.min(c, Math.hypot(a.x - p.x, a.y - p.y) - radius - 8);
  // Spike lanes: once the cannons fire, the strips along the top and bottom walls are deadly.
  if (w.elapsed >= CONFIG.cannon.startAt - 1) c = Math.min(c, CONFIG.cannon.laneY - CONFIG.cannon.arrowH - radius - Math.abs(p.y));
  return c;
}

const alive = (w: World) => w.phase !== 'dead';
const angleGap = (a: number, b: number) => {
  if (a < 0 || b < 0) return a === b ? 0 : 2;
  const d = Math.abs(a - b) % REPLAY_DIRS;
  return Math.min(d, REPLAY_DIRS - d);
};

/** A plausible follow-up direction: mostly keep going, sometimes turn a little, now and then anything. */
function nextDir(prev: number): number {
  const r = rand();
  if (prev < 0) return r < 0.5 ? -1 : Math.floor(rand() * REPLAY_DIRS);
  if (r < 0.45) return prev;
  if (r < 0.8) return (prev + (rand() < 0.5 ? 1 : -1) + REPLAY_DIRS) % REPLAY_DIRS;
  if (r < 0.92) return (prev + (rand() < 0.5 ? 3 : -3) + REPLAY_DIRS) % REPLAY_DIRS;
  return Math.floor(rand() * REPLAY_DIRS);
}

/** Scores choosing `first` now: the best of a few random futures, by time survived, then by safety margin. */
function evaluate(s: Sim, first: number, last: number): number {
  const a = clone(s);
  let minC = 999;
  for (let i = 0; i < CHUNK; i++) {
    advance(a, first);
    if (!alive(a.w)) return -1e9 + i;
    minC = Math.min(minC, clearance(a.w));
  }
  let best = -Infinity;
  for (let r = 0; r < ROLLOUTS; r++) {
    const b = clone(a);
    let prev = first;
    let survived = 0;
    let rollMin = minC;
    let sum = 0;
    let n = 0;
    outer: for (let k = 0; k < HORIZON; k++) {
      prev = nextDir(prev);
      for (let i = 0; i < CHUNK; i++) {
        advance(b, prev);
        if (b.w.phase === 'won') {
          survived = HORIZON * CHUNK;
          break outer;
        }
        if (!alive(b.w)) break outer;
        survived++;
        const c = clearance(b.w);
        rollMin = Math.min(rollMin, c);
        sum += Math.min(c, 80);
        n++;
      }
    }
    const score = survived * 20 + Math.min(rollMin, 50) * 2 + (n ? sum / n : 0);
    best = Math.max(best, score);
  }
  // Smooth steering reads as a person playing; centre-ish positions keep options open.
  const p = a.w.player;
  const edge = Math.max(Math.abs(p.x) / HW, Math.abs(p.y) / HH);
  return best - angleGap(first, last) * 6 - Math.max(0, edge - 0.75) * 120 + Math.min(minC, 40) * 0.5;
}

async function main() {
  const t0 = performance.now();
  let s: Sim = { w: createWorld(), slowUsed: false };
  let dirs = '';
  let slowmoStep = -1;
  let last = -1;
  // Snapshots per committed chunk, for backtracking when a choice leads to a dead end.
  const history: { s: Sim; dirs: string; last: number; slowmoStep: number }[] = [];
  const banned = new Map<number, Set<number>>();
  let backtracks = 0;
  const candidates = [-1, ...Array.from({ length: REPLAY_DIRS }, (_, i) => i)];

  while (s.w.phase !== 'won') {
    const chunkIndex = history.length;
    history.push({ s: clone(s), dirs, last, slowmoStep });
    const ban = banned.get(chunkIndex);
    let bestDir = -1;
    let bestScore = -Infinity;
    for (const d of candidates) {
      if (ban?.has(d)) continue;
      const sc = evaluate(s, d, last);
      if (sc > bestScore) {
        bestScore = sc;
        bestDir = d;
      }
    }
    for (let i = 0; i < CHUNK; i++) {
      if (advance(s, bestDir)) slowmoStep = dirs.length;
      dirs += encodeDir(bestDir);
      if (!alive(s.w) || s.w.phase === 'won') break;
    }
    last = bestDir;
    if (!alive(s.w)) {
      // Dead end: step back a little and forbid the choice made there.
      backtracks++;
      const back = Math.max(0, chunkIndex - 4 - Math.floor(rand() * 6));
      const h = history[back];
      history.length = back;
      if (!banned.has(back)) banned.set(back, new Set());
      banned.get(back)!.add(dirs.length > h.dirs.length ? decode(dirs[h.dirs.length]) : -1);
      for (const k of [...banned.keys()]) if (k > back) banned.delete(k);
      s = clone(h.s);
      dirs = h.dirs;
      last = h.last;
      slowmoStep = h.slowmoStep;
      log(`dead at ${s.w.elapsed.toFixed(1)} s, back to chunk ${back} (backtrack ${backtracks})`);
      if (backtracks > 400) throw new Error('too many backtracks');
    }
    if (chunkIndex % 50 === 0) {
      log(`t=${s.w.elapsed.toFixed(1)} stage ${s.w.stage}, ${((performance.now() - t0) / 1000).toFixed(0)} s planning`);
      await new Promise((r) => setTimeout(r));
    }
  }
  const replay = { dirs, slowmo: slowmoStep };
  const res = await fetch(`/__save?dir=capture&name=${NAME}.json`, { method: 'POST', body: JSON.stringify(replay) });
  log(`${await res.text()}: ${dirs.length} steps, slow-mo at step ${slowmoStep}, ${backtracks} backtracks`);
  log('done');
}

function decode(c: string): number {
  const v = c.charCodeAt(0) - 97;
  return v >= 0 && v < REPLAY_DIRS ? v : -1;
}

main().catch((e) => log(`error: ${e.message}`));
