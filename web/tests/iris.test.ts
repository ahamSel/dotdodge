import { describe, expect, it } from 'vitest';
import { createIrisSequencer, type IrisPhase } from '../src/ui/iris';

/** A fake animator: each phase waits until the test finishes it. */
function fakeAnimator() {
  const pending: { phase: IrisPhase; done: () => void }[] = [];
  return {
    play: (phase: IrisPhase, done: () => void) => void pending.push({ phase, done }),
    finish(): IrisPhase {
      const next = pending.shift();
      if (!next) throw new Error('nothing animating');
      next.done();
      return next.phase;
    },
    get busy() {
      return pending.length > 0;
    },
  };
}

describe('iris sequencing', () => {
  it('closes, swaps the screen while covered, then opens', () => {
    const anim = fakeAnimator();
    const iris = createIrisSequencer(anim.play);
    const calls: string[] = [];
    iris.request(() => calls.push('swap'));
    expect(calls).toEqual([]);
    expect(anim.finish()).toBe('close');
    expect(calls).toEqual(['swap']);
    expect(anim.finish()).toBe('open');
    expect(anim.busy).toBe(false);
  });

  it('a second request while closing replaces the first: only the latest swap runs, once', () => {
    const anim = fakeAnimator();
    const iris = createIrisSequencer(anim.play);
    const calls: string[] = [];
    iris.request(() => calls.push('congrats')); // the win wipe
    iris.request(() => calls.push('new run')); // R pressed during it
    expect(calls).toEqual([]);
    anim.finish(); // close
    anim.finish(); // open
    expect(calls).toEqual(['new run']);
    expect(anim.busy).toBe(false);
  });

  it('a request while opening swaps right away and keeps opening', () => {
    const anim = fakeAnimator();
    const iris = createIrisSequencer(anim.play);
    const calls: string[] = [];
    iris.request(() => calls.push('first'));
    anim.finish(); // close → first
    iris.request(() => calls.push('second'));
    expect(calls).toEqual(['first', 'second']);
    anim.finish(); // open
    expect(anim.busy).toBe(false);
  });

  it('works again after finishing', () => {
    const anim = fakeAnimator();
    const iris = createIrisSequencer(anim.play);
    const calls: string[] = [];
    iris.request(() => calls.push('a'));
    anim.finish();
    anim.finish();
    iris.request(() => calls.push('b'));
    anim.finish();
    expect(calls).toEqual(['a', 'b']);
  });
});
