import { describe, expect, it } from 'vitest';
import { Landmark } from './types';

describe('analysis core smoke test', () => {
  it('exposes MediaPipe Pose landmark indices', () => {
    expect(Landmark.RightWrist).toBe(16);
    expect(Landmark.LeftShoulder).toBe(11);
  });
});
