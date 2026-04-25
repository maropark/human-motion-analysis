import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type Keypoint = { x: number; y: number; confidence: number };

export type PoseFrame = {
  timestamp: number;
  /** 33-element array matching MediaPipe Pose indices. Unsupported joints are null. */
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
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type AnalysisMeta = {
  durationSec: number;
  fps: number;
  width: number;
  height: number;
};

export type AnalysisPayload = {
  poseFrames: PoseFrame[];
  ballFrames: BallFrame[];
  rim: RimBox | null;
  meta: AnalysisMeta;
};

export type AnalysisOptions = {
  /** Process every N milliseconds of video. 0 = every frame. Default 0. */
  strideMs?: number;
};

export type ProgressEvent = {
  progress: number;
  framesProcessed: number;
};

const NativeModule = requireNativeModule('ShotpathAnalyzer');
const emitter = new EventEmitter(NativeModule);

export function analyzeVideo(uri: string, options: AnalysisOptions = {}): Promise<AnalysisPayload> {
  return NativeModule.analyzeVideo(uri, options);
}

export function addProgressListener(listener: (event: ProgressEvent) => void) {
  return emitter.addListener<ProgressEvent>('onAnalysisProgress', listener);
}
