import { describe, expect, it } from 'vitest';
import { actionAllowed, canPause, shortcutFor, type KeyInfo } from '../src/input/shortcuts';

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

describe('actionAllowed', () => {
  it('only lets the in-game HUD buttons act while playing (they sit under the pause and end screens)', () => {
    expect(actionAllowed('slowmo', 'playing')).toBe(true);
    expect(actionAllowed('slowmo', 'paused')).toBe(false);
    expect(actionAllowed('pause', 'gameover')).toBe(false);
    expect(actionAllowed('pause', 'congrats')).toBe(false);
    expect(actionAllowed('resume', 'paused')).toBe(true);
    expect(actionAllowed('restart', 'gameover')).toBe(true);
  });
});

describe('canPause', () => {
  it('pauses a live run but not the beat between a death and the GOTCHA screen', () => {
    expect(canPause('playing', 'running')).toBe(true);
    expect(canPause('playing', 'intro')).toBe(true);
    expect(canPause('playing', 'dead')).toBe(false);
    expect(canPause('playing', 'won')).toBe(false);
    expect(canPause('gameover', 'dead')).toBe(false);
  });
});
