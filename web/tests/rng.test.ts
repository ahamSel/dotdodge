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
