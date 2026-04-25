/**
 * Analysis core types. Frame-indexed pose + ball observations flow through
 * rep segmentation, make/miss classification, and form metrics.
 *
 * Coordinate convention: pixel space of the source video. Origin top-left,
 * x increasing right, y increasing down. Timestamps are seconds from clip start.
 */

/** MediaPipe Pose 33-landmark indices. */
export const Landmark = {
  Nose: 0,
  LeftShoulder: 11,
  RightShoulder: 12,
  LeftElbow: 13,
  RightElbow: 14,
  LeftWrist: 15,
  RightWrist: 16,
  LeftHip: 23,
  RightHip: 24,
  LeftKnee: 25,
  RightKnee: 26,
  LeftAnkle: 27,
  RightAnkle: 28,
  LeftFootIndex: 31,
  RightFootIndex: 32,
} as const;

export type LandmarkIndex = (typeof Landmark)[keyof typeof Landmark];

export type Keypoint = {
  x: number;
  y: number;
  confidence: number;
};

export type PoseFrame = {
  timestamp: number;
  /** Indexed 0..32 per MediaPipe Pose. Missing keypoints are null. */
  landmarks: (Keypoint | null)[];
};

export type BallFrame = {
  timestamp: number;
  cx: number;
  cy: number;
  radius: number;
  confidence: number;
};

export type RimBox = {
  /** Axis-aligned rim bounding box in pixel space. Rim plane is y = top. */
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type Handedness = 'left' | 'right';

export type ShotRep = {
  id: string;
  /** Inclusive frame indices into the source pose stream. */
  startFrame: number;
  endFrame: number;
  /** Frame index of release (wrist-y minimum within the rep). */
  releaseFrame: number;
  /** Frame index of gather / set point (wrist-y local max before release). */
  setPointFrame: number;
  handedness: Handedness;
  poseFrames: PoseFrame[];
  ballFrames: BallFrame[];
};

export type MakeMissLabel = 'make' | 'miss' | 'unknown';

export type MakeMissResult = {
  label: MakeMissLabel;
  confidence: number;
  /** Reason code so the UI can explain low-confidence outcomes. */
  reason:
    | 'ball_through_rim_from_above'
    | 'ball_path_missed_rim'
    | 'no_rim_crossing'
    | 'insufficient_ball_track';
};
