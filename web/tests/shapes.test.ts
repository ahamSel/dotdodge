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
