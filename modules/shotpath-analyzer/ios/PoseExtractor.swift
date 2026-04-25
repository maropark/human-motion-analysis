import Vision

// Maps Apple Vision body pose observations to the MediaPipe Pose 33-landmark schema.
//
// Vision gives 15 body joints; the remaining MediaPipe indices (fingers, foot-index,
// facial detail) are left nil. Coordinate output is pixel space, origin top-left,
// matching the types.ts Keypoint convention.
enum PoseExtractor {
  // MediaPipe indices for the joints Vision provides.
  // https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
  private static let jointMap: [(VNHumanBodyPoseObservation.JointName, Int)] = [
    (.nose,          0),
    (.leftShoulder,  11),
    (.rightShoulder, 12),
    (.leftElbow,     13),
    (.rightElbow,    14),
    (.leftWrist,     15),
    (.rightWrist,    16),
    (.leftHip,       23),
    (.rightHip,      24),
    (.leftKnee,      25),
    (.rightKnee,     26),
    (.leftAnkle,     27),
    (.rightAnkle,    28),
  ]

  static func extract(
    from pixelBuffer: CVPixelBuffer,
    orientation: CGImagePropertyOrientation,
    displayWidth: CGFloat,
    displayHeight: CGFloat,
    timestamp: Double
  ) -> [String: Any]? {
    let request = VNDetectHumanBodyPoseRequest()
    let handler = VNImageRequestHandler(
      cvPixelBuffer: pixelBuffer,
      orientation: orientation,
      options: [:]
    )

    do {
      try handler.perform([request])
    } catch {
      return nil
    }

    guard let observation = (request.results as? [VNHumanBodyPoseObservation])?.first else {
      return nil
    }

    guard let allPoints = try? observation.recognizedPoints(.all) else { return nil }

    // Build a 33-element array; unsupported slots stay NSNull (→ null in JS).
    var landmarks = [Any](repeating: NSNull(), count: 33)

    for (jointName, mpIndex) in jointMap {
      guard let point = allPoints[jointName], point.confidence > 0 else { continue }
      // Vision: normalized coords, (0,0) = bottom-left.
      // Pixel space: (0,0) = top-left, y increases downward.
      let px = point.location.x * displayWidth
      let py = (1.0 - point.location.y) * displayHeight
      landmarks[mpIndex] = [
        "x": px,
        "y": py,
        "confidence": Double(point.confidence),
      ]
    }

    return [
      "timestamp": timestamp,
      "landmarks": landmarks,
    ]
  }
}
