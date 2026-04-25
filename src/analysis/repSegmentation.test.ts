import { describe, expect, it } from 'vitest';
import { segmentReps } from './repSegmentation';
import {
  DEFAULT_STANCE,
  makeIdleSequence,
  makePoseFrame,
  makeShotSequence,
} from './testFixtures';
import type { PoseFrame } from './types';

describe('segmentReps', () => {
  it('finds zero reps when shooter is idle', () => {
    const frames = makeIdleSequence({ startTime: 0, durationSec: 3, fps: 30 });
    expect(segmentReps(frames)).toHaveLength(0);
  });

  it('finds exactly one rep for a single shot', () => {
    const idleBefore = makeIdleSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const shot = makeShotSequence({ startTime: 1, durationSec: 1.5, fps: 30, peakLift: 1.1 });
    const idleAfter = makeIdleSequence({ startTime: 2.5, durationSec: 1, fps: 30 });
    const reps = segmentReps([...idleBefore, ...shot, ...idleAfter]);
    expect(reps).toHaveLength(1);
    const [rep] = reps;
    expect(rep.handedness).toBe('right');
    expect(rep.releaseFrame).toBeGreaterThan(rep.setPointFrame);
    expect(rep.poseFrames.length).toBeGreaterThan(0);
  });

  it('detects two reps across back-to-back shots with idle gap', () => {
    const frames: PoseFrame[] = [
      ...makeIdleSequence({ startTime: 0, durationSec: 0.5, fps: 30 }),
      ...makeShotSequence({ startTime: 0.5, durationSec: 1, fps: 30, peakLift: 1.0 }),
      ...makeIdleSequence({ startTime: 1.5, durationSec: 2, fps: 30 }),
      ...makeShotSequence({ startTime: 3.5, durationSec: 1, fps: 30, peakLift: 1.0 }),
      ...makeIdleSequence({ startTime: 4.5, durationSec: 0.5, fps: 30 }),
    ];
    const reps = segmentReps(frames);
    expect(reps).toHaveLength(2);
    expect(reps[0].releaseFrame).toBeLessThan(reps[1].setPointFrame);
  });

  it('rejects shots whose wrist does not clear the release threshold', () => {
    // peakLift 0.2 keeps wrist only slightly above shoulder — below default 0.4.
    const shot = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30, peakLift: 0.2 });
    expect(segmentReps(shot)).toHaveLength(0);
  });

  it('respects minGapSeconds by merging closely-spaced peaks', () => {
    // Two overlapping bell peaks within 0.5s — closer than default 1.2s gap.
    const frames: PoseFrame[] = [
      ...makeShotSequence({ startTime: 0, durationSec: 0.4, fps: 30, peakLift: 1.0 }),
      ...makeShotSequence({ startTime: 0.4, durationSec: 0.4, fps: 30, peakLift: 1.0 }),
    ];
    const reps = segmentReps(frames, [], { minGapSeconds: 1.2 });
    expect(reps).toHaveLength(1);
  });

  it('picks left handedness when the left wrist is the one rising', () => {
    const leftStance = { ...DEFAULT_STANCE, handedness: 'left' as const };
    const idleBefore = makeIdleSequence({
      startTime: 0,
      durationSec: 0.5,
      fps: 30,
      stance: leftStance,
    });
    const shot = makeShotSequence({
      startTime: 0.5,
      durationSec: 1.2,
      fps: 30,
      peakLift: 1.1,
      stance: leftStance,
    });
    const reps = segmentReps([...idleBefore, ...shot]);
    expect(reps).toHaveLength(1);
    expect(reps[0].handedness).toBe('left');
  });

  it('treats low-confidence frames as missing without crashing', () => {
    const shot = makeShotSequence({ startTime: 0, durationSec: 1.5, fps: 30, peakLift: 1.1 });
    // Zero out confidence for a handful of frames around the peak.
    const peakIdx = Math.floor(shot.length / 2);
    const dirty = shot.map((f, i) => {
      if (i < peakIdx - 2 || i > peakIdx + 2) return f;
      return {
        ...f,
        landmarks: f.landmarks.map((kp) => (kp ? { ...kp, confidence: 0.05 } : kp)),
      } satisfies PoseFrame;
    });
    // Surrounding frames still carry the lift; shouldn't throw.
    const reps = segmentReps(dirty);
    expect(Array.isArray(reps)).toBe(true);
  });

  it('returns [] for an empty input', () => {
    expect(segmentReps([])).toHaveLength(0);
  });

  it('attaches ball frames that fall inside the rep window', () => {
    const shot = makeShotSequence({ startTime: 0, durationSec: 1.5, fps: 30, peakLift: 1.1 });
    const ballFrames = Array.from({ length: 30 }, (_, i) => ({
      timestamp: 0.5 + i * 0.02,
      cx: 400 + i * 5,
      cy: 200 - i * 4,
      radius: 10,
      confidence: 0.8,
    }));
    const outsideBall = [
      { timestamp: 5.0, cx: 0, cy: 0, radius: 10, confidence: 0.8 },
    ];
    const reps = segmentReps(shot, [...ballFrames, ...outsideBall]);
    expect(reps).toHaveLength(1);
    expect(reps[0].ballFrames.length).toBe(ballFrames.length);
    expect(reps[0].ballFrames.every((b) => b.timestamp < 5.0)).toBe(true);
  });

  it('handles a frame with no landmarks at all without crashing', () => {
    const bad: PoseFrame = { timestamp: 0, landmarks: new Array(33).fill(null) };
    const shot = makeShotSequence({ startTime: 0.5, durationSec: 1.2, fps: 30, peakLift: 1.1 });
    // Prepend the bad frame — torso length unavailable there.
    const reps = segmentReps([bad, ...shot]);
    expect(reps.length).toBeGreaterThan(0);
    expect(reps[0].poseFrames.length).toBeGreaterThan(0);
    // Also make sure makePoseFrame itself builds a valid neutral frame.
    expect(() => makePoseFrame(0, 0)).not.toThrow();
  });
});
