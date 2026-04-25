import AVFoundation
import Vision

enum AnalysisError: LocalizedError {
  case invalidURL(String)
  case noVideoTrack
  case readerSetupFailed(String)

  var errorDescription: String? {
    switch self {
    case .invalidURL(let uri):     return "Cannot resolve video URI: \(uri)"
    case .noVideoTrack:            return "No video track found in asset"
    case .readerSetupFailed(let m): return "AVAssetReader failed: \(m)"
    }
  }
}

enum VideoAnalyzer {
  // MARK: - Public entry point

  static func analyze(
    videoUri: String,
    strideMs: Double,
    onProgress: @escaping (Float, Int) -> Void
  ) async throws -> [String: Any] {
    let url = try resolveURL(from: videoUri)
    let asset = AVURLAsset(url: url)

    // Load track metadata
    let tracks = try await asset.loadTracks(withMediaType: .video)
    guard let videoTrack = tracks.first else { throw AnalysisError.noVideoTrack }

    let frameRate        = try await videoTrack.load(.nominalFrameRate)
    let naturalSize      = try await videoTrack.load(.naturalSize)
    let preferredTx      = try await videoTrack.load(.preferredTransform)
    let duration         = try await asset.load(.duration)
    let durationSec      = CMTimeGetSeconds(duration)

    // Display dimensions after the track's preferred transform (handles portrait video)
    let txRect       = CGRect(origin: .zero, size: naturalSize).applying(preferredTx)
    let displayWidth = abs(txRect.width)
    let displayHeight = abs(txRect.height)
    let orientation  = visionOrientation(from: preferredTx)

    let totalFrames  = max(1, Int(durationSec * Double(frameRate)))
    // Stride in nanoseconds; 0 means process every frame
    let strideNs     = strideMs > 0 ? Int64(strideMs * 1_000_000) : 0

    // MARK: - AVAssetReader scan loop (synchronous after setup)

    let reader = try AVAssetReader(asset: asset)
    let outputSettings: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ]
    let trackOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: outputSettings)
    trackOutput.alwaysCopiesSampleData = false
    reader.add(trackOutput)

    guard reader.startReading() else {
      throw AnalysisError.readerSetupFailed(reader.error?.localizedDescription ?? "unknown")
    }

    var poseFrames: [[String: Any]] = []
    var framesProcessed  = 0
    var lastTimestampNs  = Int64.min
    var lastProgressFrame = 0

    while reader.status == .reading,
          let sampleBuffer = trackOutput.copyNextSampleBuffer() {
      let pts          = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
      let timestampSec = CMTimeGetSeconds(pts)
      let timestampNs  = Int64(timestampSec * 1_000_000_000)

      if strideNs > 0 && (timestampNs - lastTimestampNs) < strideNs { continue }
      lastTimestampNs = timestampNs

      guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { continue }

      if let frame = PoseExtractor.extract(
        from: pixelBuffer,
        orientation: orientation,
        displayWidth: displayWidth,
        displayHeight: displayHeight,
        timestamp: timestampSec
      ) {
        poseFrames.append(frame)
      }

      framesProcessed += 1
      if framesProcessed - lastProgressFrame >= 30 {
        lastProgressFrame = framesProcessed
        onProgress(min(Float(framesProcessed) / Float(totalFrames), 0.99), framesProcessed)
      }
    }

    if reader.status == .failed {
      throw AnalysisError.readerSetupFailed(reader.error?.localizedDescription ?? "read error")
    }

    onProgress(1.0, framesProcessed)

    return [
      "poseFrames": poseFrames,
      "ballFrames": [[String: Any]](),  // Phase 3: CoreML YOLO ball/rim detector
      "rim": NSNull(),
      "meta": [
        "durationSec": durationSec,
        "fps": Double(frameRate),
        "width": Int(displayWidth),
        "height": Int(displayHeight),
      ] as [String: Any],
    ]
  }

  // MARK: - Helpers

  private static func resolveURL(from uri: String) throws -> URL {
    if uri.hasPrefix("file://") {
      guard let url = URL(string: uri) else { throw AnalysisError.invalidURL(uri) }
      return url
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    guard let url = URL(string: uri) else { throw AnalysisError.invalidURL(uri) }
    return url
  }

  // Derive Vision orientation from the video track's preferred transform.
  // iPhone portrait video: transform rotates 90° CW → Vision .right.
  private static func visionOrientation(from t: CGAffineTransform) -> CGImagePropertyOrientation {
    switch (t.a, t.b, t.c, t.d) {
    case (0,  1, -1, 0): return .right  // portrait (iPhone default)
    case (0, -1,  1, 0): return .left   // portrait upside-down
    case (-1, 0, 0, -1): return .down   // landscape upside-down
    default:             return .up     // landscape (normal)
    }
  }
}
