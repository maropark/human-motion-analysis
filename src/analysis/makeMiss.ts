import type { BallFrame, MakeMissResult, RimBox } from './types';

export type MakeMissOptions = {
  /** Minimum ball frames required to attempt classification. */
  minBallFrames: number;
  /**
   * How much horizontal slack to give the rim (fraction of rim width) when
   * calling a downward crossing a make. Accounts for detector jitter.
   */
  rimXTolerance: number;
  /** Minimum ball confidence for a frame to be used. */
  minBallConfidence: number;
};

export const DEFAULT_MAKE_MISS_OPTIONS: MakeMissOptions = {
  minBallFrames: 5,
  rimXTolerance: 0.05,
  minBallConfidence: 0.3,
};

function usableBall(frames: BallFrame[], minConfidence: number): BallFrame[] {
  return frames
    .filter((f) => f.confidence >= minConfidence)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Classify a rep as make/miss from its ball track and the rim box.
 *
 * Rule: find the first frame-pair where the ball crosses rim.top going downward.
 * Linearly interpolate the x at the crossing. If x lands inside the rim's x
 * range (with a small tolerance) → make. Otherwise → miss. If no downward
 * crossing is present, label 'unknown' with a specific reason.
 */
export function classifyMakeMiss(
  ballFrames: BallFrame[],
  rim: RimBox,
  options: Partial<MakeMissOptions> = {}
): MakeMissResult {
  const opts = { ...DEFAULT_MAKE_MISS_OPTIONS, ...options };
  const frames = usableBall(ballFrames, opts.minBallConfidence);

  if (frames.length < opts.minBallFrames) {
    return {
      label: 'unknown',
      confidence: 0.2,
      reason: 'insufficient_ball_track',
    };
  }

  const rimWidth = rim.right - rim.left;
  const tolerance = rimWidth * opts.rimXTolerance;
  const rimLeftSoft = rim.left - tolerance;
  const rimRightSoft = rim.right + tolerance;

  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    const aAbove = a.cy < rim.top;
    const bAtOrBelow = b.cy >= rim.top;
    if (!(aAbove && bAtOrBelow)) continue;

    const dy = b.cy - a.cy;
    const t = dy === 0 ? 0 : (rim.top - a.cy) / dy;
    const xAtCrossing = a.cx + (b.cx - a.cx) * t;
    const insideRim = xAtCrossing >= rimLeftSoft && xAtCrossing <= rimRightSoft;

    // Confidence scales with how densely the ball was tracked near the rim.
    const nearRimFrames = frames.filter(
      (f) => Math.abs(f.cy - rim.top) < Math.max(rimWidth * 0.5, 40)
    ).length;
    const trackConfidence = Math.min(1, 0.4 + 0.1 * nearRimFrames);

    return insideRim
      ? {
          label: 'make',
          confidence: trackConfidence,
          reason: 'ball_through_rim_from_above',
        }
      : {
          label: 'miss',
          confidence: trackConfidence,
          reason: 'ball_path_missed_rim',
        };
  }

  // No downward crossing — either the ball never descended past rim.top
  // (short) or tracking was lost before it did.
  const lowestPoint = frames.reduce((min, f) => (f.cy > min ? f.cy : min), -Infinity);
  const descendedTowardRim = lowestPoint >= rim.top - rimWidth;
  return {
    label: descendedTowardRim ? 'miss' : 'unknown',
    confidence: descendedTowardRim ? 0.45 : 0.25,
    reason: 'no_rim_crossing',
  };
}
