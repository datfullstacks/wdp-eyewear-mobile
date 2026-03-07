package __APP_PACKAGE__.tryon

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import __APP_PACKAGE__.BuildConfig
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableNativeMap

class WdpTryOnModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val REQUEST_CODE_TRYON = 48112
  }

  private var pendingPromise: Promise? = null
  private var pendingProductId: String = ""

  init {
    reactContext.addActivityEventListener(
      object : BaseActivityEventListener() {
        override fun onActivityResult(
          activity: Activity,
          requestCode: Int,
          resultCode: Int,
          data: Intent?
        ) {
          if (requestCode != REQUEST_CODE_TRYON) return
          resolvePendingTryOnResult(resultCode, data)
        }
      }
    )
  }

  override fun getName(): String = "WdpTryOnSdk"

  @ReactMethod
  fun startTryOnSession(payload: ReadableMap?, promise: Promise) {
    launchTryOn(payload, promise)
  }

  @ReactMethod
  fun startSession(payload: ReadableMap?, promise: Promise) {
    launchTryOn(payload, promise)
  }

  @ReactMethod
  fun openTryOn(payload: ReadableMap?, promise: Promise) {
    launchTryOn(payload, promise)
  }

  private fun launchTryOn(payload: ReadableMap?, promise: Promise) {
    val productId = readString(payload, "productId")
    val sdkKey = readString(payload, "sdkKey")
    val effectPath = readString(payload, "effectPath")
    val launchUrl = resolveLaunchUrl(payload)
    val hasLocalEffect = effectPath.isNotEmpty() && !isOpenableUrl(effectPath)

    val banubaEnabled = BuildConfig.BANUBA_ENABLED
    val banubaLinked = hasClass("com.banuba.sdk.manager.BanubaSdkManager")
    val nativeBanubaReady = banubaEnabled && banubaLinked

    if (nativeBanubaReady) {
      if (sdkKey.isEmpty()) {
        promise.reject("E_MISSING_TOKEN", "Banuba token is missing.")
        return
      }

      if (hasLocalEffect) {
        openNativeTryOn(payload, productId, promise)
        return
      }

      if (launchUrl.isNotEmpty()) {
        openExternalUrl(
          url = launchUrl,
          productId = productId,
          nativeAvailable = true,
          status = "fallback_opened",
          message = "Local Banuba effectPath is missing. Opened fallback URL.",
          promise = promise
        )
        return
      }

      promise.reject(
        "E_MISSING_EFFECT_PATH",
        "Banuba native session requires effectPath (for example: effects/my_effect)."
      )
      return
    }

    if (launchUrl.isNotEmpty()) {
      val reason =
        if (!banubaEnabled) {
          "Banuba Android SDK is disabled. Opened fallback URL."
        } else {
          "Banuba Android SDK is not linked. Opened fallback URL."
        }

      openExternalUrl(
        url = launchUrl,
        productId = productId,
        nativeAvailable = false,
        status = "fallback_opened",
        message = reason,
        promise = promise
      )
      return
    }

    if (!banubaEnabled) {
      promise.reject(
        "E_BANUBA_NOT_ENABLED",
        "Banuba Android SDK is disabled. Set BANUBA_ENABLED=true before building."
      )
      return
    }

    promise.reject(
      "E_BANUBA_NOT_LINKED",
      "Banuba Android SDK is not linked. Check BANUBA_ANDROID_MAVEN_URL and BANUBA_ANDROID_SDK_DEPENDENCY."
    )
  }

  private fun resolveLaunchUrl(payload: ReadableMap?): String {
    val keys = listOf("arUrl", "fallbackUrl", "launchUrl")
    for (key in keys) {
      val value = readString(payload, key)
      if (isExternalFallbackUrl(value)) return value
    }
    return ""
  }

  private fun openNativeTryOn(payload: ReadableMap?, productId: String, promise: Promise) {
    val sdkKey = readString(payload, "sdkKey")
    val productName = readString(payload, "productName")
    val effectPath = readString(payload, "effectPath")
    val fallbackUrl = resolveLaunchUrl(payload)
    val resourcePaths = readStringArray(payload, "resourcePaths")

    val intent = Intent(reactContext, WdpTryOnActivity::class.java).apply {
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_ID, productId)
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_NAME, productName)
      putExtra(WdpTryOnActivity.EXTRA_SDK_KEY, sdkKey)
      putExtra(WdpTryOnActivity.EXTRA_EFFECT_PATH, effectPath)
      putExtra(WdpTryOnActivity.EXTRA_FALLBACK_URL, fallbackUrl)
      putStringArrayListExtra(
        WdpTryOnActivity.EXTRA_RESOURCE_PATHS,
        ArrayList(resourcePaths)
      )
    }

    try {
      val hostActivity = reactContext.currentActivity
      if (hostActivity != null) {
        pendingPromise?.reject(
          "E_TRYON_ALREADY_RUNNING",
          "Another native try-on session is already running."
        )
        pendingPromise = promise
        pendingProductId = productId
        hostActivity.startActivityForResult(intent, REQUEST_CODE_TRYON)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
        val result = WritableNativeMap().apply {
          putString("status", "launched")
          putString("message", "Native try-on launched (background context).")
          putString("productId", productId)
          putBoolean("nativeAvailable", true)
        }
        promise.resolve(result)
      }
    } catch (error: Throwable) {
      pendingPromise = null
      pendingProductId = ""
      promise.reject("E_NATIVE_OPEN_FAILED", error.message, error)
    }
  }

  private fun resolvePendingTryOnResult(resultCode: Int, data: Intent?) {
    val promise = pendingPromise ?: return
    pendingPromise = null

    val status =
      data?.getStringExtra(WdpTryOnActivity.RESULT_STATUS)
        ?: if (resultCode == Activity.RESULT_OK) "completed" else "cancelled"
    val message =
      data?.getStringExtra(WdpTryOnActivity.RESULT_MESSAGE)
        ?: if (status == "completed") "Native Banuba try-on completed." else "Native Banuba try-on cancelled."

    val result = WritableNativeMap().apply {
      putString("status", status)
      putString("message", message)
      putString("productId", pendingProductId)
      putBoolean("nativeAvailable", true)
      putString(
        "effectPath",
        data?.getStringExtra(WdpTryOnActivity.RESULT_EFFECT_PATH) ?: ""
      )
    }
    pendingProductId = ""
    promise.resolve(result)
  }

  private fun readString(payload: ReadableMap?, key: String): String {
    if (payload == null || !payload.hasKey(key) || payload.isNull(key)) return ""
    return payload.getString(key)?.trim().orEmpty()
  }

  private fun readStringArray(payload: ReadableMap?, key: String): List<String> {
    if (payload == null || !payload.hasKey(key) || payload.isNull(key)) return emptyList()

    return when (payload.getType(key)) {
      ReadableType.Array -> normalizeStringArray(payload.getArray(key))
      ReadableType.String ->
        payload.getString(key)
          ?.split(",")
          ?.map { it.trim() }
          ?.filter { it.isNotEmpty() }
          ?: emptyList()
      else -> emptyList()
    }
  }

  private fun normalizeStringArray(array: ReadableArray?): List<String> {
    if (array == null) return emptyList()
    val out = ArrayList<String>()
    for (index in 0 until array.size()) {
      if (array.getType(index) != ReadableType.String || array.isNull(index)) continue
      val value = array.getString(index)?.trim().orEmpty()
      if (value.isNotEmpty()) out.add(value)
    }
    return out
  }

  private fun isHttpUrl(value: String): Boolean {
    return value.startsWith("https://", ignoreCase = true) ||
      value.startsWith("http://", ignoreCase = true)
  }

  private fun isModelAssetUrl(value: String): Boolean {
    val normalized = value.lowercase()
    return normalized.contains(".glb") || normalized.contains(".gltf") || normalized.contains(".usdz")
  }

  private fun isExternalFallbackUrl(value: String): Boolean {
    return isHttpUrl(value) && !isModelAssetUrl(value)
  }

  private fun isOpenableUrl(value: String): Boolean {
    return value.startsWith("https://", ignoreCase = true) ||
      value.startsWith("http://", ignoreCase = true) ||
      value.startsWith("file://", ignoreCase = true) ||
      value.startsWith("content://", ignoreCase = true)
  }

  private fun openExternalUrl(
    url: String,
    productId: String,
    nativeAvailable: Boolean,
    status: String,
    message: String,
    promise: Promise
  ) {
    val uri = Uri.parse(url)
    if (uri.scheme.isNullOrEmpty()) {
      promise.reject("E_INVALID_URL", "Try-on URL is invalid: $url")
      return
    }

    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      val hostActivity = reactContext.currentActivity
      if (hostActivity != null) {
        hostActivity.startActivity(intent)
      } else {
        reactContext.startActivity(intent)
      }

      val result = WritableNativeMap().apply {
        putString("status", status)
        putString("message", message)
        putString("url", url)
        putString("productId", productId)
        putBoolean("nativeAvailable", nativeAvailable)
      }
      promise.resolve(result)
    } catch (_: ActivityNotFoundException) {
      promise.reject("E_ACTIVITY_NOT_FOUND", "No app can handle URL: $url")
    } catch (error: Throwable) {
      promise.reject("E_OPEN_URL_FAILED", error.message, error)
    }
  }

  private fun hasClass(className: String): Boolean {
    return try {
      Class.forName(className)
      true
    } catch (_: Throwable) {
      false
    }
  }
}
