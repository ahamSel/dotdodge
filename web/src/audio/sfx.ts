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
