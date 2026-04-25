import {
  type BallFrame,
  type Handedness,
  Landmark,
  type PoseFrame,
  type ShotRep,
} from './types';

export type SegmentationOptions = {
  /** Minimum keypoint confidence for a landmark to be considered present. */
  minConfidence: number;
  /**
   * How high the shooting wrist must rise above the shoulder (in shoulder-to-hip
   * torso-lengths) to count as a release candidate. 0.4 ≈ wrist clearly above head.
   */
  releasePeakTorsoFraction: number;
  /** Minimum seconds between two release peaks. Rejects double-counting. */
  minGapSeconds: number;
  /** Moving-average window size for smoothing the wrist-y signal. Must be odd. */
  smoothingWindow: number;
  /** Seconds of pose context to keep before the set point. */
  preSetPointPaddingSeconds: number;
  /**
   * Seconds to keep after release. Must cover the ball's full arc for make/miss
   * classification — free-throw ball time is typically 0.8–1.2s.
   */
  postReleasePaddingSeconds: number;
};

export const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  minConfidence: 0.3,
  releasePeakTorsoFraction: 0.4,
  minGapSeconds: 1.2,
  smoothingWindow: 3,
  preSetPointPaddingSeconds: 0.3,
  postReleasePaddingSeconds: 1.2,
};

type PerFrameSignal = {
  /** Wrist height above shoulder normalized by torso length. NaN if unavailable. */
  dominantWristAboveShoulder: number;
  dominantSide: Handedness | null;
};

function keypoint(frame: PoseFrame, idx: number, minConfidence: number) {
  const kp = frame.landmarks[idx];
  if (!kp || kp.confidence < minConfidence) return null;
  return kp;
}

function torsoLength(frame: PoseFrame, minConfidence: number): number | null {
  const shoulder =
    keypoint(frame, Landmark.RightShoulder, minConfidence) ??
    keypoint(frame, Landmark.LeftShoulder, minConfidence);
  const hip =
    keypoint(frame, Landmark.RightHip, minConfidence) ??
    keypoint(frame, Landmark.LeftHip, minConfidence);
  if (!shoulder || !hip) return null;
  const dy = hip.y - shoulder.y;
  return dy > 1 ? dy : null;
}

function wristAboveShoulder(
  frame: PoseFrame,
  side: Handedness,
  torso: number,
  minConfidence: number
): number | null {
  const shoulderIdx =
    side === 'right' ? Landmark.RightShoulder : Landmark.LeftShoulder;
  const wristIdx = side === 'right' ? Landmark.RightWrist : Landmark.LeftWrist;
  const shoulder = keypoint(frame, shoulderIdx, minConfidence);
  const wrist = keypoint(frame, wristIdx, minConfidence);
  if (!shoulder || !wrist) return null;
  // y is pixel-space (down is positive), so wrist above shoulder means wrist.y < shoulder.y.
  return (shoulder.y - wrist.y) / torso;
}

function computeSignals(
  frames: PoseFrame[],
  opts: SegmentationOptions
): PerFrameSignal[] {
  return frames.map((frame) => {
    const torso = torsoLength(frame, opts.minConfidence);
    if (!torso) {
      return { dominantWristAboveShoulder: NaN, dominantSide: null };
    }
    const right = wristAboveShoulder(frame, 'right', torso, opts.minConfidence);
    const left = wristAboveShoulder(frame, 'left', torso, opts.minConfidence);
    if (right == null && left == null) {
      return { dominantWristAboveShoulder: NaN, dominantSide: null };
    }
    if (right == null) return { dominantWristAboveShoulder: left!, dominantSide: 'left' };
    if (left == null) return { dominantWristAboveShoulder: right, dominantSide: 'right' };
    return right >= left
      ? { dominantWristAboveShoulder: right, dominantSide: 'right' }
      : { dominantWristAboveShoulder: left, dominantSide: 'left' };
  });
}

function smoothSignal(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= values.length) continue;
      const v = values[j];
      if (Number.isNaN(v)) continue;
      sum += v;
      count += 1;
    }
    return count > 0 ? sum / count : NaN;
  });
}

function findReleasePeaks(
  values: number[],
  timestamps: number[],
  opts: SegmentationOptions
): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    if (Number.isNaN(v) || v < opts.releasePeakTorsoFraction) continue;
    const prev = values[i - 1];
    const next = values[i + 1];
    if (Number.isNaN(prev) || Number.isNaN(next)) continue;
    if (v > prev && v >= next) peaks.push(i);
  }
  // Enforce min gap; keep the strongest peak within each gap window.
  const filtered: number[] = [];
  for (const idx of peaks) {
    const last = filtered[filtered.length - 1];
    if (last == null || timestamps[idx] - timestamps[last] >= opts.minGapSeconds) {
      filtered.push(idx);
      continue;
    }
    if (values[idx] > values[last]) filtered[filtered.length - 1] = idx;
  }
  return filtered;
}

function findSetPointBefore(values: number[], releaseIdx: number): number {
  // Walk back until wrist signal falls below ~0 (around shoulder height) or we
  // hit a local minimum. The gather point is where the upward motion began.
  for (let i = releaseIdx - 1; i > 0; i--) {
    const v = values[i];
    if (Number.isNaN(v)) continue;
    if (v <= 0) return i;
    const prev = values[i - 1];
    if (!Number.isNaN(prev) && v < prev) return i;
  }
  return 0;
}

function sliceByTimeRange<T extends { timestamp: number }>(
  items: T[],
  startTs: number,
  endTs: number
): T[] {
  return items.filter((item) => item.timestamp >= startTs && item.timestamp <= endTs);
}

export function segmentReps(
  poseFrames: PoseFrame[],
  ballFrames: BallFrame[] = [],
  options: Partial<SegmentationOptions> = {}
): ShotRep[] {
  const opts = { ...DEFAULT_SEGMENTATION_OPTIONS, ...options };
  if (poseFrames.length === 0) return [];

  const rawSignal = computeSignals(poseFrames, opts);
  const smoothed = smoothSignal(
    rawSignal.map((s) => s.dominantWristAboveShoulder),
    opts.smoothingWindow
  );
  const timestamps = poseFrames.map((f) => f.timestamp);
  const peaks = findReleasePeaks(smoothed, timestamps, opts);

  const reps: ShotRep[] = [];
  for (let i = 0; i < peaks.length; i++) {
    const releaseFrame = peaks[i];
    const setPointFrame = findSetPointBefore(smoothed, releaseFrame);
    const startTs = Math.max(0, timestamps[setPointFrame] - opts.preSetPointPaddingSeconds);
    const endTs = timestamps[releaseFrame] + opts.postReleasePaddingSeconds;
    const startFrame = Math.max(
      0,
      poseFrames.findIndex((f) => f.timestamp >= startTs)
    );
    let endFrame = poseFrames.findIndex((f) => f.timestamp > endTs);
    if (endFrame === -1) endFrame = poseFrames.length - 1;
    else endFrame = Math.max(releaseFrame, endFrame - 1);

    // Handedness at the peak frame; fall back to any adjacent frame that has it.
    let handedness: Handedness = rawSignal[releaseFrame].dominantSide ?? 'right';
    for (let j = 0; j < 5 && !rawSignal[releaseFrame].dominantSide; j++) {
      const look = rawSignal[releaseFrame + j]?.dominantSide ?? rawSignal[releaseFrame - j]?.dominantSide;
      if (look) {
        handedness = look;
        break;
      }
    }

    reps.push({
      id: `rep-${i + 1}`,
      startFrame,
      endFrame,
      releaseFrame,
      setPointFrame,
      handedness,
      poseFrames: poseFrames.slice(startFrame, endFrame + 1),
      ballFrames: sliceByTimeRange(
        ballFrames,
        poseFrames[startFrame].timestamp,
        poseFrames[endFrame].timestamp
      ),
    });
  }
  return reps;
}
