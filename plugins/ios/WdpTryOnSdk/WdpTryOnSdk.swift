import Foundation
import React
import UIKit

@objc(WdpTryOnSdk)
final class WdpTryOnSdk: NSObject {
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private weak var activeController: UIViewController?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(startTryOnSession:resolver:rejecter:)
  func startTryOnSession(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    launchTryOn(payload, resolve: resolve, reject: reject)
  }

  @objc(startSession:resolver:rejecter:)
  func startSession(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    launchTryOn(payload, resolve: resolve, reject: reject)
  }

  @objc(openTryOn:resolver:rejecter:)
  func openTryOn(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    launchTryOn(payload, resolve: resolve, reject: reject)
  }

  private func launchTryOn(
    _ payload: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      if self.pendingResolve != nil {
        reject("E_SESSION_RUNNING", "A try-on session is already running.", nil)
        return
      }

      let normalized = WdpTryOnPayload(payload: payload as? [String: Any] ?? [:])
      if normalized.productId.isEmpty {
        reject("E_INVALID_PAYLOAD", "productId is required.", nil)
        return
      }

      guard let presenter = Self.getTopViewController() else {
        reject("E_NO_ACTIVITY", "Cannot start try-on because no active view controller exists.", nil)
        return
      }

      self.pendingResolve = resolve
      self.pendingReject = reject

      let viewController = WdpTryOnViewController(payload: normalized) { result in
        self.activeController = nil
        self.resolvePending(result)
      }

      self.activeController = viewController
      viewController.modalPresentationStyle = .fullScreen
      presenter.present(viewController, animated: true, completion: nil)
    }
  }

  private func resolvePending(_ result: WdpTryOnResult) {
    defer {
      pendingResolve = nil
      pendingReject = nil
    }

    switch result {
    case .success(let status, let message, let data):
      pendingResolve?([
        "status": status,
        "message": message,
        "data": data,
      ])

    case .cancelled(let message):
      pendingReject?("E_TRYON_CANCELLED", message, nil)

    case .failure(let code, let message):
      pendingReject?(code, message, nil)
    }
  }

  private static func getTopViewController(base: UIViewController? = nil) -> UIViewController? {
    let baseController: UIViewController?
    if let base = base {
      baseController = base
    } else {
      let connectedScenes = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .filter { $0.activationState == .foregroundActive }
      let keyWindow = connectedScenes
        .flatMap { $0.windows }
        .first(where: { $0.isKeyWindow })
      baseController = keyWindow?.rootViewController
    }

    if let nav = baseController as? UINavigationController {
      return getTopViewController(base: nav.visibleViewController)
    }

    if let tab = baseController as? UITabBarController {
      return getTopViewController(base: tab.selectedViewController)
    }

    if let presented = baseController?.presentedViewController {
      return getTopViewController(base: presented)
    }

    return baseController
  }
}
