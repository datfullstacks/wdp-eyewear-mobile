import AVFoundation
import Foundation
import UIKit

#if canImport(BanubaSDK)
import BanubaSDK
#elseif canImport(BanubaSdk)
import BanubaSdk
#endif

struct WdpTryOnPayload {
  let sdkKey: String
  let productId: String
  let productName: String
  let effectPath: String
  let arUrl: String
  let fallbackUrl: String
  let modelUrl: String
  let glbUrl: String
  let usdzUrl: String
  let resourcePaths: [String]
  let metadata: [String: Any]

  init(payload: [String: Any]) {
    sdkKey = Self.readString(payload["sdkKey"])
    productId = Self.readString(payload["productId"])
    productName = Self.readString(payload["productName"])
    effectPath = Self.readString(payload["effectPath"])
    arUrl = Self.readString(payload["arUrl"])
    fallbackUrl = Self.readString(payload["fallbackUrl"])
    modelUrl = Self.readString(payload["modelUrl"])
    glbUrl = Self.readString(payload["glbUrl"])
    usdzUrl = Self.readString(payload["usdzUrl"])
    resourcePaths = Self.readStringArray(payload["resourcePaths"])
    metadata = payload
  }

  var resolvedEffectPath: String {
    if !effectPath.isEmpty {
      return effectPath
    }
    return "effects/test_TeethTone"
  }

  private static func readString(_ value: Any?) -> String {
    guard let str = value as? String else { return "" }
    return str.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func readStringArray(_ value: Any?) -> [String] {
    guard let arr = value as? [Any] else { return [] }
    return arr
      .compactMap { $0 as? String }
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
}

enum WdpTryOnResult {
  case success(status: String, message: String, data: [String: Any])
  case cancelled(message: String)
  case failure(code: String, message: String)
}

final class WdpTryOnViewController: UIViewController {
  private let payload: WdpTryOnPayload
  private let completion: (WdpTryOnResult) -> Void

  private let statusLabel = UILabel()
  private let closeButton = UIButton(type: .system)
  private let doneButton = UIButton(type: .system)

#if canImport(BanubaSDK) || canImport(BanubaSdk)
  private static var isBanubaInitialized = false

  private var sdkManager: BanubaSdkManager?
  private var cameraDevice: CameraDevice?
  private var cameraInput: Camera?
  private var renderView: EffectPlayerView?
#endif

  init(payload: WdpTryOnPayload, completion: @escaping (WdpTryOnResult) -> Void) {
    self.payload = payload
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUi()
    startTryOn()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stopSession()
  }

  private func setupUi() {
    view.backgroundColor = .black

    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.textColor = .white
    statusLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    statusLabel.numberOfLines = 0
    statusLabel.backgroundColor = UIColor(white: 0.0, alpha: 0.45)
    statusLabel.layer.cornerRadius = 8
    statusLabel.layer.masksToBounds = true
    statusLabel.text = [
      "Banuba AR session",
      "Product: \(payload.productName.isEmpty ? "N/A" : payload.productName)",
      "Product ID: \(payload.productId.isEmpty ? "N/A" : payload.productId)",
    ].joined(separator: "\n")

    let buttonsContainer = UIStackView()
    buttonsContainer.translatesAutoresizingMaskIntoConstraints = false
    buttonsContainer.axis = .horizontal
    buttonsContainer.spacing = 12
    buttonsContainer.distribution = .fillEqually

    closeButton.setTitle("Close", for: .normal)
    closeButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
    closeButton.backgroundColor = UIColor(white: 0.0, alpha: 0.55)
    closeButton.tintColor = .white
    closeButton.layer.cornerRadius = 10
    closeButton.addTarget(self, action: #selector(handleClose), for: .touchUpInside)

    doneButton.setTitle("Done", for: .normal)
    doneButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
    doneButton.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.9)
    doneButton.tintColor = .white
    doneButton.layer.cornerRadius = 10
    doneButton.addTarget(self, action: #selector(handleDone), for: .touchUpInside)

    buttonsContainer.addArrangedSubview(closeButton)
    buttonsContainer.addArrangedSubview(doneButton)

    view.addSubview(statusLabel)
    view.addSubview(buttonsContainer)

    NSLayoutConstraint.activate([
      statusLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

      buttonsContainer.heightAnchor.constraint(equalToConstant: 48),
      buttonsContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      buttonsContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      buttonsContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
    ])
  }

  private func startTryOn() {
#if canImport(BanubaSDK) || canImport(BanubaSdk)
    guard !payload.sdkKey.isEmpty else {
      finish(.failure(code: "E_MISSING_TOKEN", message: "Banuba token is missing."))
      return
    }

    if !Self.isBanubaInitialized {
      let resourcePaths = payload.resourcePaths.isEmpty ? nil : payload.resourcePaths
      BanubaSdkManager.initialize(resourcePath: resourcePaths, clientTokenString: payload.sdkKey)
      Self.isBanubaInitialized = true
    }

    let playerView = EffectPlayerView(frame: view.bounds)
    playerView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.insertSubview(playerView, at: 0)
    renderView = playerView

    let manager = BanubaSdkManager()
    manager.setRenderTarget(view: playerView, playerConfiguration: nil)

    let cameraDevice = CameraDevice(
      cameraMode: .FrontCameraSession,
      captureSessionPreset: .hd1280x720
    )
    let camera = Camera(cameraDevice: cameraDevice)

    manager.input = camera
    manager.startEffectPlayer()
    cameraDevice.start()

    let effectName = payload.resolvedEffectPath
    _ = manager.loadEffect(effectName, synchronous: false)

    sdkManager = manager
    self.cameraDevice = cameraDevice
    cameraInput = camera

    statusLabel.text = [
      statusLabel.text ?? "",
      "Effect: \(effectName)",
    ].joined(separator: "\n")
#else
    finish(
      .failure(
        code: "E_BANUBA_NOT_LINKED",
        message: "Banuba iOS SDK is not linked. Set BANUBA_ENABLED=true and provide iOS pod source before building."
      )
    )
#endif
  }

  private func stopSession() {
#if canImport(BanubaSDK) || canImport(BanubaSdk)
    cameraDevice?.stop()
    sdkManager?.stopEffectPlayer()
    sdkManager?.removeRenderTarget()
    sdkManager = nil
    cameraDevice = nil
    cameraInput = nil
    renderView = nil
#endif
  }

  @objc
  private func handleClose() {
    finish(.cancelled(message: "Native try-on closed by user."))
  }

  @objc
  private func handleDone() {
    finish(
      .success(
        status: "completed",
        message: "Native Banuba try-on completed.",
        data: [
          "productId": payload.productId,
          "productName": payload.productName,
          "effectPath": payload.resolvedEffectPath,
          "fallbackUrl": payload.fallbackUrl,
        ]
      )
    )
  }

  private func finish(_ result: WdpTryOnResult) {
    dismiss(animated: true) {
      self.completion(result)
    }
  }
}
