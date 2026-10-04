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
