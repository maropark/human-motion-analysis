/**
 * Synthetic keypoint generators for unit tests. Coordinates in pixel space,
 * origin top-left, y-down. A shooter stands in mid-frame.
 */
import { type BallFrame, type Keypoint, Landmark, type PoseFrame } from './types';

export type StanceParams = {
  shoulderY: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
  centerX: number;
  shoulderWidth: number;
  hipWidth: number;
  /** Which arm shoots; guide arm sits near the torso. */
  handedness: 'left' | 'right';
};

export const DEFAULT_STANCE: StanceParams = {
  shoulderY: 300,
  hipY: 500,
  kneeY: 650,
  ankleY: 780,
  centerX: 400,
  shoulderWidth: 60,
  hipWidth: 50,
  handedness: 'right',
};

function kp(x: number, y: number, confidence = 0.95): Keypoint {
  return { x, y, confidence };
}

/**
 * Build one pose frame. `wristLift` ∈ [0,1] interpolates shooting wrist between
 * hip height (0) and ~one torso-length above shoulder (1).
 */
export function makePoseFrame(
  timestamp: number,
  wristLift: number,
  stance: StanceParams = DEFAULT_STANCE,
  confidence = 0.95
): PoseFrame {
  const torso = stance.hipY - stance.shoulderY;
  const shooting = stance.handedness;
  const shootingSign = shooting === 'right' ? 1 : -1;

  const shootingWristY =
    stance.hipY - (stance.hipY - (stance.shoulderY - torso)) * Math.max(0, Math.min(1, wristLift));
  const guideWristY = stance.hipY - 20;

  const landmarks: (Keypoint | null)[] = new Array(33).fill(null);

  landmarks[Landmark.Nose] = kp(stance.centerX, stance.shoulderY - 80, confidence);
  landmarks[Landmark.LeftShoulder] = kp(
    stance.centerX - stance.shoulderWidth / 2,
    stance.shoulderY,
    confidence
  );
  landmarks[Landmark.RightShoulder] = kp(
    stance.centerX + stance.shoulderWidth / 2,
    stance.shoulderY,
    confidence
  );
  landmarks[Landmark.LeftElbow] = kp(
    stance.centerX - stance.shoulderWidth / 2 - 10,
    (stance.shoulderY + stance.hipY) / 2,
    confidence
  );
  landmarks[Landmark.RightElbow] = kp(
    stance.centerX + stance.shoulderWidth / 2 + 10,
    (stance.shoulderY + stance.hipY) / 2,
    confidence
  );
  landmarks[Landmark.LeftWrist] = kp(
    stance.centerX - stance.shoulderWidth / 2 - 15,
    shooting === 'left' ? shootingWristY : guideWristY,
    confidence
  );
  landmarks[Landmark.RightWrist] = kp(
    stance.centerX + stance.shoulderWidth / 2 + 15,
    shooting === 'right' ? shootingWristY : guideWristY,
    confidence
  );
  landmarks[Landmark.LeftHip] = kp(
    stance.centerX - stance.hipWidth / 2,
    stance.hipY,
    confidence
  );
  landmarks[Landmark.RightHip] = kp(
    stance.centerX + stance.hipWidth / 2,
    stance.hipY,
    confidence
  );
  landmarks[Landmark.LeftKnee] = kp(stance.centerX - 25, stance.kneeY, confidence);
  landmarks[Landmark.RightKnee] = kp(stance.centerX + 25, stance.kneeY, confidence);
  landmarks[Landmark.LeftAnkle] = kp(stance.centerX - 30, stance.ankleY, confidence);
  landmarks[Landmark.RightAnkle] = kp(stance.centerX + 30, stance.ankleY, confidence);

  // Convenience: mark dominant side non-null, guide side returns wrist lift of 0.
  // No-op; both arms populated above for a realistic silhouette.
  void shootingSign;

  return { timestamp, landmarks };
}

/**
 * Generate a shot rep as a bell-curve wrist lift over `durationSec` centered on release.
 * `fps` controls frame sampling rate.
 */
export function makeShotSequence(opts: {
  startTime: number;
  durationSec: number;
  fps: number;
  peakLift?: number;
  stance?: StanceParams;
}): PoseFrame[] {
  const { startTime, durationSec, fps, peakLift = 1.0, stance = DEFAULT_STANCE } = opts;
  const totalFrames = Math.round(durationSec * fps);
  const frames: PoseFrame[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const t = startTime + i / fps;
    const progress = i / (totalFrames - 1); // 0 → 1
    // Cosine bell: 0 at ends, 1 at center.
    const lift = peakLift * (0.5 - 0.5 * Math.cos(progress * 2 * Math.PI));
    frames.push(makePoseFrame(t, lift, stance));
  }
  return frames;
}

/** Static standing frames — no shot. */
export function makeIdleSequence(opts: {
  startTime: number;
  durationSec: number;
  fps: number;
  stance?: StanceParams;
}): PoseFrame[] {
  const { startTime, durationSec, fps, stance = DEFAULT_STANCE } = opts;
  const totalFrames = Math.round(durationSec * fps);
  return Array.from({ length: totalFrames }, (_, i) =>
    makePoseFrame(startTime + i / fps, 0, stance)
  );
}

export function makeBallArc(opts: {
  startTime: number;
  durationSec: number;
  fps: number;
  /** Ball starts at shooter hand and travels to target. */
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Peak height offset above the line from start to end (smaller y = higher arc). */
  peakOffsetY: number;
}): BallFrame[] {
  const { startTime, durationSec, fps, startX, startY, endX, endY, peakOffsetY } = opts;
  const total = Math.round(durationSec * fps);
  const frames: BallFrame[] = [];
  for (let i = 0; i < total; i++) {
    const t = startTime + i / fps;
    const p = i / (total - 1);
    const x = startX + (endX - startX) * p;
    const linearY = startY + (endY - startY) * p;
    const arc = -4 * peakOffsetY * p * (1 - p);
    frames.push({ timestamp: t, cx: x, cy: linearY + arc, radius: 10, confidence: 0.9 });
  }
  return frames;
}
