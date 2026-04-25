import { describe, expect, it } from 'vitest';
import { classifyMakeMiss } from './makeMiss';
import { makeBallArc } from './testFixtures';
import type { RimBox } from './types';

const RIM: RimBox = {
  left: 680,
  right: 780,
  top: 160,
  bottom: 175,
};

describe('classifyMakeMiss', () => {
  it('labels a clean swish as make', () => {
    // End x tuned so that the arc's downward rim-y crossing lands near rim center.
    const ball = makeBallArc({
      startTime: 0,
      durationSec: 1.0,
      fps: 60,
      startX: 420,
      startY: 300,
      endX: 830,
      endY: 260,
      peakOffsetY: 180,
    });
    const result = classifyMakeMiss(ball, RIM);
    expect(result.label).toBe('make');
    expect(result.reason).toBe('ball_through_rim_from_above');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('labels a ball that crosses rim-y outside the rim x-range as miss', () => {
    // End point drifts well past the rim horizontally.
    const ball = makeBallArc({
      startTime: 0,
      durationSec: 1.0,
      fps: 60,
      startX: 420,
      startY: 300,
      endX: 900,
      endY: 260,
      peakOffsetY: 180,
    });
    const result = classifyMakeMiss(ball, RIM);
    expect(result.label).toBe('miss');
    expect(result.reason).toBe('ball_path_missed_rim');
  });

  it('labels a short shot that never reaches rim height as miss', () => {
    // Ball never rises high enough — stays well below rim.top (y > 200).
    const ball = makeBallArc({
      startTime: 0,
      durationSec: 1.0,
      fps: 60,
      startX: 420,
      startY: 300,
      endX: 600,
      endY: 280,
      peakOffsetY: 80,
    });
    const result = classifyMakeMiss(ball, RIM);
    expect(result.label).toBe('miss');
    expect(result.reason).toBe('no_rim_crossing');
  });

  it('returns unknown when ball track is too sparse', () => {
    const sparse = [
      { timestamp: 0, cx: 400, cy: 300, radius: 10, confidence: 0.8 },
      { timestamp: 0.5, cx: 500, cy: 220, radius: 10, confidence: 0.8 },
    ];
    const result = classifyMakeMiss(sparse, RIM);
    expect(result.label).toBe('unknown');
    expect(result.reason).toBe('insufficient_ball_track');
  });

  it('ignores low-confidence ball frames', () => {
    // Low-confidence noise around the rim that would otherwise look like a make.
    const noise = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 0.01,
      cx: 730,
      cy: 140 + i * 3, // crosses rim.top downward
      radius: 10,
      confidence: 0.1,
    }));
    const result = classifyMakeMiss(noise, RIM);
    expect(result.label).toBe('unknown');
  });

  it('rejects an upward crossing (ball moving up through rim-y)', () => {
    // Ball rises from below rim to above rim without any downward crossing.
    const rising = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i * 0.02,
      cx: 730,
      cy: 200 - i * 5, // starts below rim, moves up
      radius: 10,
      confidence: 0.9,
    }));
    const result = classifyMakeMiss(rising, RIM);
    expect(result.label).not.toBe('make');
  });
});
