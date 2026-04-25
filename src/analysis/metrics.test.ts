import { describe, expect, it } from 'vitest';
import {
  computeFormMetrics,
  elbowPathDeviation,
  landingDrift,
  releaseAngle,
  setPointHeight,
  trunkLean,
} from './metrics';
import { DEFAULT_STANCE, makeBallArc, makeShotSequence } from './testFixtures';
import { Landmark, type PoseFrame, type ShotRep } from './types';

function buildRep(poseFrames: PoseFrame[], overrides: Partial<ShotRep> = {}): ShotRep {
  // Pick release at global wrist-max frame for the generated bell curve.
  const releaseFrame = Math.floor(poseFrames.length / 2);
  const setPointFrame = Math.floor(poseFrames.length / 4);
  return {
    id: 'rep-test',
    startFrame: 0,
    endFrame: poseFrames.length - 1,
    releaseFrame,
    setPointFrame,
    handedness: 'right',
    poseFrames,
    ballFrames: [],
    ...overrides,
  };
}

describe('releaseAngle', () => {
  it('returns ~50° for a steeply rising ball', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 60 });
    const releaseFrame = Math.floor(poseFrames.length / 2);
    const ballFrames = [
      {
        timestamp: poseFrames[releaseFrame].timestamp,
        cx: 400,
        cy: 300,
        radius: 10,
        confidence: 0.9,
      },
      {
        timestamp: poseFrames[releaseFrame].timestamp + 0.033,
        cx: 410,
        cy: 288,
        radius: 10,
        confidence: 0.9,
      },
    ];
    const rep = buildRep(poseFrames, { releaseFrame, ballFrames });
    const result = releaseAngle(rep);
    expect(result.value).toBeGreaterThan(45);
    expect(result.value).toBeLessThan(55);
    expect(result.status).toBe('good');
  });

  it('is unknown when the rep has no ball frames', () => {
    const rep = buildRep(makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 }));
    expect(releaseAngle(rep).status).toBe('unknown');
  });
});

describe('elbowPathDeviation', () => {
  it('is small when the shooting elbow tracks cleanly', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const rep = buildRep(poseFrames);
    const result = elbowPathDeviation(rep);
    expect(result.value).not.toBeNull();
    expect(result.value!).toBeLessThan(0.05);
    expect(result.status).toBe('good');
  });

  it('flags outward drift as needs_work', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    // Jitter the right elbow x outward on half the frames.
    const jittered = poseFrames.map((f, i) => {
      const lms = f.landmarks.slice();
      const elbow = lms[Landmark.RightElbow];
      if (elbow && i % 2 === 0) {
        lms[Landmark.RightElbow] = { ...elbow, x: elbow.x + 60 };
      }
      return { ...f, landmarks: lms } as PoseFrame;
    });
    const rep = buildRep(jittered);
    const result = elbowPathDeviation(rep);
    expect(result.status).toBe('needs_work');
  });
});

describe('setPointHeight', () => {
  it('measures a positive value when wrist is above shoulder at set point', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    // Force the set-point frame to be where wrist is already lifted a bit.
    const rep = buildRep(poseFrames, { setPointFrame: Math.floor(poseFrames.length * 0.4) });
    const result = setPointHeight(rep);
    expect(result.value).not.toBeNull();
    expect(result.value!).toBeGreaterThan(0);
  });

  it('handles missing wrist by returning unknown', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const stripped = poseFrames.map((f) => {
      const lms = f.landmarks.slice();
      lms[Landmark.RightWrist] = null;
      lms[Landmark.LeftWrist] = null;
      return { ...f, landmarks: lms } as PoseFrame;
    });
    const rep = buildRep(stripped);
    expect(setPointHeight(rep).status).toBe('unknown');
  });
});

describe('trunkLean', () => {
  it('is ~0 when shooter is upright', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const rep = buildRep(poseFrames);
    const result = trunkLean(rep);
    expect(result.value).not.toBeNull();
    expect(Math.abs(result.value!)).toBeLessThan(1);
    expect(result.status).toBe('good');
  });

  it('grows when the shoulder drifts forward of the hip', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const leaning = poseFrames.map((f) => {
      const lms = f.landmarks.slice();
      const rs = lms[Landmark.RightShoulder];
      const ls = lms[Landmark.LeftShoulder];
      if (rs) lms[Landmark.RightShoulder] = { ...rs, x: rs.x + 80 };
      if (ls) lms[Landmark.LeftShoulder] = { ...ls, x: ls.x + 80 };
      return { ...f, landmarks: lms } as PoseFrame;
    });
    const rep = buildRep(leaning);
    const result = trunkLean(rep);
    expect(result.value).toBeGreaterThan(10);
    expect(result.status).toBe('needs_work');
  });
});

describe('landingDrift', () => {
  it('reports ~0 drift when feet do not move', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const rep = buildRep(poseFrames);
    const result = landingDrift(rep);
    expect(Math.abs(result.value!)).toBeLessThan(0.01);
  });

  it('detects forward drift when the last frame is shifted ahead', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 30 });
    const lastIdx = poseFrames.length - 1;
    const shifted = poseFrames.map((f, i) => {
      if (i !== lastIdx) return f;
      const lms = f.landmarks.slice();
      for (const idx of [Landmark.LeftAnkle, Landmark.RightAnkle]) {
        const a = lms[idx];
        if (a) lms[idx] = { ...a, x: a.x + 120 };
      }
      return { ...f, landmarks: lms } as PoseFrame;
    });
    const rep = buildRep(shifted);
    const result = landingDrift(rep);
    expect(result.value).toBeGreaterThan(0.3);
    expect(result.status).toBe('needs_work');
  });
});

describe('computeFormMetrics integration', () => {
  it('returns all 5 metrics for a clean rep', () => {
    const poseFrames = makeShotSequence({ startTime: 0, durationSec: 1, fps: 60 });
    const releaseFrame = Math.floor(poseFrames.length / 2);
    const ballFrames = makeBallArc({
      startTime: poseFrames[releaseFrame].timestamp,
      durationSec: 0.8,
      fps: 60,
      startX: 420,
      startY: 260,
      endX: 760,
      endY: 200,
      peakOffsetY: 120,
    });
    const rep = buildRep(poseFrames, { releaseFrame, ballFrames });
    const metrics = computeFormMetrics(rep);
    expect(Object.keys(metrics)).toEqual([
      'releaseAngleDeg',
      'elbowPathDeviation',
      'setPointHeight',
      'trunkLeanDeg',
      'landingDrift',
    ]);
    for (const v of Object.values(metrics)) {
      expect(['good', 'monitor', 'needs_work', 'unknown']).toContain(v.status);
    }
  });

  it('uses stance handedness for the shooting-side metrics', () => {
    const poseFrames = makeShotSequence({
      startTime: 0,
      durationSec: 1,
      fps: 30,
      stance: { ...DEFAULT_STANCE, handedness: 'left' },
    });
    const rep = buildRep(poseFrames, { handedness: 'left' });
    const result = setPointHeight(rep);
    expect(result.status).not.toBe('unknown');
  });
});
