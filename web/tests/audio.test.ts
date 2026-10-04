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
