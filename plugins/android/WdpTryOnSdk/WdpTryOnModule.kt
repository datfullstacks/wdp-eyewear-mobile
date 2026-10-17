package __APP_PACKAGE__.tryon

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import __APP_PACKAGE__.BuildConfig
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import org.json.JSONArray
import org.json.JSONObject

class WdpTryOnModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val REQUEST_CODE_TRYON = 48112
    private const val TAG = "WdpTryOn"
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
    val scene = readString(payload, "scene")
    val prefabJson = readJsonObjectString(payload, "prefab")
    val fallbackUrl = resolveLaunchUrl(payload)
    val resourcePaths = readStringArray(payload, "resourcePaths")
    val selectedModelId = readString(payload, "selectedModelId")
    val modelsJson = readModelsJson(payload)

    Log.d(
      TAG,
      "openNativeTryOn productId=$productId effectPath=$effectPath scene=$scene " +
        "resourcePaths=${resourcePaths.size} selectedModelId=$selectedModelId " +
        "hasPrefab=${prefabJson.isNotEmpty()} modelsJsonLength=${modelsJson.length}"
    )

    val intent = Intent(reactContext, WdpTryOnActivity::class.java).apply {
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_ID, productId)
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_NAME, productName)
      putExtra(WdpTryOnActivity.EXTRA_SDK_KEY, sdkKey)
      putExtra(WdpTryOnActivity.EXTRA_EFFECT_PATH, effectPath)
      putExtra(WdpTryOnActivity.EXTRA_SCENE, scene)
      putExtra(WdpTryOnActivity.EXTRA_PREFAB_JSON, prefabJson)
      putExtra(WdpTryOnActivity.EXTRA_FALLBACK_URL, fallbackUrl)
      putExtra(WdpTryOnActivity.EXTRA_SELECTED_MODEL_ID, selectedModelId)
      putExtra(WdpTryOnActivity.EXTRA_MODELS_JSON, modelsJson)
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

  private fun readModelsJson(payload: ReadableMap?): String {
    if (payload == null || !payload.hasKey("models") || payload.isNull("models")) return ""
    if (payload.getType("models") != ReadableType.Array) return ""

    val source = payload.getArray("models") ?: return ""
    val output = JSONArray()

    for (index in 0 until source.size()) {
      if (source.isNull(index) || source.getType(index) != ReadableType.Map) continue
      val model = source.getMap(index) ?: continue
      val node = JSONObject()

      putString(node, "id", readString(model, "id"))
      putString(node, "label", readString(model, "label"))
      putString(node, "glbUrl", readString(model, "glbUrl"))
      putString(node, "usdzUrl", readString(model, "usdzUrl"))
      putString(node, "arUrl", readString(model, "arUrl"))
      putString(node, "launchUrl", readString(model, "launchUrl"))
      putString(node, "effectPath", readString(model, "effectPath"))
      putString(node, "scene", readString(model, "scene"))
      putString(node, "fallbackUrl", readString(model, "fallbackUrl"))
      node.put("ready", readBoolean(model, "ready", false))
      readJsonObject(model, "prefab")?.let { node.put("prefab", it) }

      val resourcePaths = readStringArray(model, "resourcePaths")
      if (resourcePaths.isNotEmpty()) {
        val resourcesJson = JSONArray()
        resourcePaths.forEach { resourcesJson.put(it) }
        node.put("resourcePaths", resourcesJson)
      }

      output.put(node)
    }

    return if (output.length() > 0) output.toString() else ""
  }

  private fun putString(target: JSONObject, key: String, value: String) {
    if (value.isNotEmpty()) target.put(key, value)
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
      putString(
        "selectedModelId",
        data?.getStringExtra(WdpTryOnActivity.RESULT_MODEL_ID) ?: ""
      )
    }
    pendingProductId = ""
    promise.resolve(result)
  }

  private fun readString(payload: ReadableMap?, key: String): String {
    if (payload == null || !payload.hasKey(key) || payload.isNull(key)) return ""
    return payload.getString(key)?.trim().orEmpty()
  }

  private fun readBoolean(payload: ReadableMap?, key: String, defaultValue: Boolean = false): Boolean {
    if (payload == null || !payload.hasKey(key) || payload.isNull(key)) return defaultValue
    return when (payload.getType(key)) {
      ReadableType.Boolean -> payload.getBoolean(key)
      ReadableType.String -> payload.getString(key)?.trim()?.equals("true", ignoreCase = true) == true
      else -> defaultValue
    }
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

  private fun readJsonObjectString(payload: ReadableMap?, key: String): String {
    return readJsonObject(payload, key)?.toString().orEmpty()
  }

  private fun readJsonObject(payload: ReadableMap?, key: String): JSONObject? {
    if (payload == null || !payload.hasKey(key) || payload.isNull(key)) return null
    if (payload.getType(key) != ReadableType.Map) return null
    return readableMapToJson(payload.getMap(key))
  }

  private fun readableMapToJson(map: ReadableMap?): JSONObject {
    val output = JSONObject()
    if (map == null) return output

    val iterator = map.keySetIterator()
    while (iterator.hasNextKey()) {
      val nextKey = iterator.nextKey()
      if (map.isNull(nextKey)) {
        output.put(nextKey, JSONObject.NULL)
        continue
      }

      when (map.getType(nextKey)) {
        ReadableType.Null -> output.put(nextKey, JSONObject.NULL)
        ReadableType.Boolean -> output.put(nextKey, map.getBoolean(nextKey))
        ReadableType.Number -> output.put(nextKey, map.getDouble(nextKey))
        ReadableType.String -> output.put(nextKey, map.getString(nextKey))
        ReadableType.Map -> output.put(nextKey, readableMapToJson(map.getMap(nextKey)))
        ReadableType.Array -> output.put(nextKey, readableArrayToJson(map.getArray(nextKey)))
      }
    }

    return output
  }

  private fun readableArrayToJson(array: ReadableArray?): JSONArray {
    val output = JSONArray()
    if (array == null) return output

    for (index in 0 until array.size()) {
      if (array.isNull(index)) {
        output.put(JSONObject.NULL)
        continue
      }

      when (array.getType(index)) {
        ReadableType.Null -> output.put(JSONObject.NULL)
        ReadableType.Boolean -> output.put(array.getBoolean(index))
        ReadableType.Number -> output.put(array.getDouble(index))
        ReadableType.String -> output.put(array.getString(index))
        ReadableType.Map -> output.put(readableMapToJson(array.getMap(index)))
        ReadableType.Array -> output.put(readableArrayToJson(array.getArray(index)))
      }
    }

    return output
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
    val normalized = value.lowercase()
    return normalized.startsWith("file://") ||
      normalized.startsWith("content://") ||
      normalized.startsWith("http://") ||
      normalized.startsWith("https://")
  }

  private fun openExternalUrl(
    url: String,
    productId: String,
    nativeAvailable: Boolean,
    status: String,
    message: String,
    promise: Promise
  ) {
    val target = Uri.parse(url)
    val intent = Intent(Intent.ACTION_VIEW, target).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      reactContext.startActivity(intent)
      val result = WritableNativeMap().apply {
        putString("status", status)
        putString("message", message)
        putString("productId", productId)
        putBoolean("nativeAvailable", nativeAvailable)
        putString("fallbackUrl", url)
      }
      promise.resolve(result)
    } catch (error: ActivityNotFoundException) {
      promise.reject("E_FALLBACK_OPEN_FAILED", "No activity can open fallback URL.", error)
    } catch (error: Throwable) {
      promise.reject("E_FALLBACK_OPEN_FAILED", error.message, error)
    }
  }

  private fun hasClass(name: String): Boolean {
    return try {
      Class.forName(name)
      true
    } catch (_: Throwable) {
      false
    }
  }
}
