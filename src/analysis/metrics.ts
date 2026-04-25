import { type Keypoint, Landmark, type PoseFrame, type ShotRep } from './types';

export type MetricStatus = 'good' | 'monitor' | 'needs_work' | 'unknown';

export type MetricResult = {
  value: number | null;
  unit: string;
  status: MetricStatus;
  /** 0..1 — how much to trust this metric. Low confidence hides it in the UI. */
  confidence: number;
};

export type FormMetrics = {
  releaseAngleDeg: MetricResult;
  elbowPathDeviation: MetricResult;
  setPointHeight: MetricResult;
  trunkLeanDeg: MetricResult;
  landingDrift: MetricResult;
};

const MIN_CONFIDENCE = 0.3;

function kp(frame: PoseFrame | undefined, idx: number): Keypoint | null {
  if (!frame) return null;
  const point = frame.landmarks[idx];
  if (!point || point.confidence < MIN_CONFIDENCE) return null;
  return point;
}

function torsoLength(frame: PoseFrame): number | null {
  const shoulder =
    kp(frame, Landmark.RightShoulder) ?? kp(frame, Landmark.LeftShoulder);
  const hip = kp(frame, Landmark.RightHip) ?? kp(frame, Landmark.LeftHip);
  if (!shoulder || !hip) return null;
  const dy = hip.y - shoulder.y;
  return dy > 1 ? dy : null;
}

function unknown(unit: string): MetricResult {
  return { value: null, unit, status: 'unknown', confidence: 0 };
}

function shoulderIdx(rep: ShotRep) {
  return rep.handedness === 'right' ? Landmark.RightShoulder : Landmark.LeftShoulder;
}
function elbowIdx(rep: ShotRep) {
  return rep.handedness === 'right' ? Landmark.RightElbow : Landmark.LeftElbow;
}
function ankleIdx(rep: ShotRep, side: 'left' | 'right') {
  return side === 'right' ? Landmark.RightAnkle : Landmark.LeftAnkle;
}

function classify(
  value: number,
  good: [number, number],
  monitor: [number, number]
): MetricStatus {
  if (value >= good[0] && value <= good[1]) return 'good';
  if (value >= monitor[0] && value <= monitor[1]) return 'monitor';
  return 'needs_work';
}

/**
 * Release angle proxy: angle of ball's velocity vector just after release,
 * measured from horizontal. Needs at least two ball frames within the rep.
 */
export function releaseAngle(rep: ShotRep): MetricResult {
  const ballInRep = rep.ballFrames;
  if (ballInRep.length < 2) return unknown('deg');
  const releaseTs = rep.poseFrames[rep.releaseFrame - rep.startFrame]?.timestamp;
  if (releaseTs == null) return unknown('deg');
  // Take the first two ball samples at or after release.
  const post = ballInRep.filter((b) => b.timestamp >= releaseTs).slice(0, 2);
  if (post.length < 2) return unknown('deg');
  const dx = post[1].cx - post[0].cx;
  // y is pixel-down; a rising ball has negative dy. Convert to upward-positive.
  const dy = -(post[1].cy - post[0].cy);
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return unknown('deg');
  const angle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
  return {
    value: angle,
    unit: 'deg',
    status: classify(angle, [45, 52], [40, 58]),
    confidence: 0.75,
  };
}

/**
 * Elbow path deviation: lateral spread of the shooting elbow relative to the
 * shoulder, from set point through release. Smaller is more consistent. Value
 * is normalized by torso length so it's scale-invariant.
 */
export function elbowPathDeviation(rep: ShotRep): MetricResult {
  const startOffset = rep.setPointFrame - rep.startFrame;
  const endOffset = rep.releaseFrame - rep.startFrame;
  const slice = rep.poseFrames.slice(startOffset, endOffset + 1);
  const torso = torsoLength(slice[slice.length - 1] ?? slice[0]);
  if (!torso) return unknown('ratio');

  const sIdx = shoulderIdx(rep);
  const eIdx = elbowIdx(rep);
  const offsets: number[] = [];
  for (const frame of slice) {
    const shoulder = kp(frame, sIdx);
    const elbow = kp(frame, eIdx);
    if (!shoulder || !elbow) continue;
    offsets.push((elbow.x - shoulder.x) / torso);
  }
  if (offsets.length < 3) return unknown('ratio');

  const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const variance =
    offsets.reduce((acc, v) => acc + (v - mean) ** 2, 0) / offsets.length;
  const stdDev = Math.sqrt(variance);

  return {
    value: stdDev,
    unit: 'ratio',
    status: classify(stdDev, [0, 0.04], [0.04, 0.08]),
    confidence: Math.min(1, 0.3 + 0.05 * offsets.length),
  };
}

/**
 * Set-point height: wrist height above shoulder at the gather frame, in torso
 * lengths. Positive means set point is above shoulder.
 */
export function setPointHeight(rep: ShotRep): MetricResult {
  const offset = rep.setPointFrame - rep.startFrame;
  const frame = rep.poseFrames[offset];
  if (!frame) return unknown('torso');
  const torso = torsoLength(frame);
  if (!torso) return unknown('torso');
  const sIdx = shoulderIdx(rep);
  const wIdx = rep.handedness === 'right' ? Landmark.RightWrist : Landmark.LeftWrist;
  const shoulder = kp(frame, sIdx);
  const wrist = kp(frame, wIdx);
  if (!shoulder || !wrist) return unknown('torso');

  const value = (shoulder.y - wrist.y) / torso;
  return {
    value,
    unit: 'torso',
    status: classify(value, [-0.2, 0.3], [-0.4, 0.5]),
    confidence: 0.8,
  };
}

/**
 * Trunk lean: angle of shoulder-to-hip line from vertical, measured at release.
 * Positive = leaning in shooting direction; 0 = upright.
 */
export function trunkLean(rep: ShotRep): MetricResult {
  const offset = rep.releaseFrame - rep.startFrame;
  const frame = rep.poseFrames[offset];
  if (!frame) return unknown('deg');
  const rs = kp(frame, Landmark.RightShoulder);
  const ls = kp(frame, Landmark.LeftShoulder);
  const rh = kp(frame, Landmark.RightHip);
  const lh = kp(frame, Landmark.LeftHip);
  if (!rs || !ls || !rh || !lh) return unknown('deg');
  const shoulderMid = { x: (rs.x + ls.x) / 2, y: (rs.y + ls.y) / 2 };
  const hipMid = { x: (rh.x + lh.x) / 2, y: (rh.y + lh.y) / 2 };
  const dx = shoulderMid.x - hipMid.x;
  const dy = shoulderMid.y - hipMid.y;
  if (Math.abs(dy) < 1) return unknown('deg');
  // Vertical is (0, -1) in image space (shoulder above hip). Angle from vertical:
  const angleRad = Math.atan2(Math.abs(dx), -dy);
  const angleDeg = angleRad * (180 / Math.PI);
  return {
    value: angleDeg,
    unit: 'deg',
    status: classify(angleDeg, [0, 5], [0, 10]),
    confidence: 0.7,
  };
}

/**
 * Landing drift: horizontal shift of the feet midpoint from rep start to rep
 * end, in torso lengths. Large drift suggests forward/backward fade.
 */
export function landingDrift(rep: ShotRep): MetricResult {
  const first = rep.poseFrames[0];
  const last = rep.poseFrames[rep.poseFrames.length - 1];
  if (!first || !last) return unknown('torso');
  const torso = torsoLength(last) ?? torsoLength(first);
  if (!torso) return unknown('torso');
  const startLeft = kp(first, ankleIdx(rep, 'left'));
  const startRight = kp(first, ankleIdx(rep, 'right'));
  const endLeft = kp(last, ankleIdx(rep, 'left'));
  const endRight = kp(last, ankleIdx(rep, 'right'));
  if (!startLeft || !startRight || !endLeft || !endRight) return unknown('torso');
  const startMid = (startLeft.x + startRight.x) / 2;
  const endMid = (endLeft.x + endRight.x) / 2;
  const drift = (endMid - startMid) / torso;
  const absDrift = Math.abs(drift);
  return {
    value: drift,
    unit: 'torso',
    status: classify(absDrift, [0, 0.1], [0, 0.25]),
    confidence: 0.7,
  };
}

export function computeFormMetrics(rep: ShotRep): FormMetrics {
  return {
    releaseAngleDeg: releaseAngle(rep),
    elbowPathDeviation: elbowPathDeviation(rep),
    setPointHeight: setPointHeight(rep),
    trunkLeanDeg: trunkLean(rep),
    landingDrift: landingDrift(rep),
  };
}
