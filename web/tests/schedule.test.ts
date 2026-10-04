import { describe, expect, it } from 'vitest';
import {
  countdownShown,
  elapsedAt,
  formatTime,
  INTRO,
  lastBlinkStart,
  launchTimeOf,
  stageAt,
  warningLit,
  warnTimeOf,
} from '../src/game/schedule';

describe('schedule', () => {
  it('starts the countdown when missile 0 launches', () => {
    expect(INTRO).toBe(2.75);
    expect(elapsedAt(1)).toBe(0);
    expect(elapsedAt(INTRO + 5)).toBeCloseTo(5);
  });

  it('moves through the six stages at the 2020 thresholds', () => {
    expect(stageAt(0)).toBe(1);
    expect(stageAt(16.99)).toBe(1);
    expect(stageAt(17)).toBe(2);
    expect(stageAt(37)).toBe(3);
    expect(stageAt(57)).toBe(4);
    expect(stageAt(80)).toBe(5);
    expect(stageAt(96.99)).toBe(5);
    expect(stageAt(97)).toBe(6);
    expect(stageAt(500)).toBe(6);
  });

  it('shows the countdown rounded up, so the last second reads 1', () => {
    expect(countdownShown(0)).toBe(120);
    expect(countdownShown(0.5)).toBe(120);
    expect(countdownShown(1)).toBe(119);
    expect(countdownShown(110)).toBe(10);
    expect(countdownShown(119.5)).toBe(1);
    expect(countdownShown(120)).toBe(0);
    expect(countdownShown(130)).toBe(0);
  });

  it('warns 2.75 s before each launch, missile 0 at world time 0', () => {
    expect(warnTimeOf(0)).toBe(0);
    expect(launchTimeOf(0)).toBe(2.75);
    expect(warnTimeOf(1)).toBeCloseTo(INTRO + 17);
    expect(launchTimeOf(6)).toBeCloseTo(INTRO + 97 + 2.75);
  });

  it('lights the chevron three times', () => {
    expect(warningLit(0.5)).toBe(false);
    expect(warningLit(0.7)).toBe(true);
    expect(warningLit(1.1)).toBe(false);
    expect(warningLit(1.4)).toBe(true);
    expect(warningLit(2.1)).toBe(true);
    expect(warningLit(2.4)).toBe(false);
    expect(lastBlinkStart(1.5)).toBe(1.33);
    expect(lastBlinkStart(0.1)).toBe(-1);
  });

  it('formats seconds as m:ss', () => {
    expect(formatTime(61.9)).toBe('1:01');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(120)).toBe('2:00');
  });
});
