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
