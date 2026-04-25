import ExpoModulesCore

public class ShotpathAnalyzerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotpathAnalyzer")

    Events("onAnalysisProgress")

    AsyncFunction("analyzeVideo") { (videoUri: String, options: [String: Any], promise: Promise) in
      let onProgress: (Float, Int) -> Void = { [weak self] progress, framesProcessed in
        self?.sendEvent("onAnalysisProgress", [
          "progress": progress,
          "framesProcessed": framesProcessed,
        ])
      }
      Task.detached(priority: .userInitiated) {
        do {
          let strideMs = options["strideMs"] as? Double ?? 0
          let result = try await VideoAnalyzer.analyze(
            videoUri: videoUri,
            strideMs: strideMs,
            onProgress: onProgress
          )
          promise.resolve(result)
        } catch {
          promise.reject("ANALYSIS_FAILED", error.localizedDescription)
        }
      }
    }
  }
}
