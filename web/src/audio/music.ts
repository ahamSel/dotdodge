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
  /** Tab hidden: silent until it comes back. */
  setHidden(on: boolean): void;
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
  let ducked = false;
  let hidden = false;

  function applyDuck() {
    const ctx = engine.ctx();
    if (ctx && duck) duck.gain.setTargetAtTime(hidden ? 0 : ducked ? 0.35 : 1, ctx.currentTime, 0.1);
  }

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
      ducked = on;
      applyDuck();
    },
    setHidden(on) {
      hidden = on;
      applyDuck();
    },
  };
}
