package com.anonymous.WDP301_Mobile

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

class WdpTryOnSdkModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val REQUEST_CODE_TRY_ON = 31021
  }

  private var pendingPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
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
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "Cannot start try-on because currentActivity is null.")
      return
    }

    if (pendingPromise != null) {
      promise.reject("E_SESSION_RUNNING", "A try-on session is already running.")
      return
    }

    if (payload == null) {
      promise.reject("E_INVALID_PAYLOAD", "Payload is required.")
      return
    }

    val productId = readString(payload, "productId")
    if (productId.isBlank()) {
      promise.reject("E_INVALID_PAYLOAD", "productId is required.")
      return
    }

    val intent = Intent(activity, WdpTryOnActivity::class.java).apply {
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_ID, productId)
      putExtra(WdpTryOnActivity.EXTRA_PRODUCT_NAME, readString(payload, "productName"))
      putExtra(WdpTryOnActivity.EXTRA_SDK_KEY, readString(payload, "sdkKey"))
      putExtra(WdpTryOnActivity.EXTRA_EFFECT_PATH, readString(payload, "effectPath"))
      putExtra(WdpTryOnActivity.EXTRA_MODEL_URL, readString(payload, "modelUrl"))
      putExtra(WdpTryOnActivity.EXTRA_GLB_URL, readString(payload, "glbUrl"))
      putExtra(WdpTryOnActivity.EXTRA_USDZ_URL, readString(payload, "usdzUrl"))
      putExtra(WdpTryOnActivity.EXTRA_AR_URL, readString(payload, "arUrl"))
      putExtra(WdpTryOnActivity.EXTRA_FALLBACK_URL, readString(payload, "fallbackUrl"))
      putExtra(
        WdpTryOnActivity.EXTRA_RESOURCE_PATHS,
        readStringArray(payload, "resourcePaths")
      )
      putExtra(WdpTryOnActivity.EXTRA_PAYLOAD_JSON, readableMapToJson(payload))
    }

    pendingPromise = promise

    try {
      activity.startActivityForResult(intent, REQUEST_CODE_TRY_ON)
    } catch (error: Throwable) {
      pendingPromise = null
      promise.reject("E_START_FAILED", error.message, error)
    }
  }

  private fun readString(payload: ReadableMap, key: String): String {
    if (!payload.hasKey(key) || payload.isNull(key)) return ""
    return payload.getString(key)?.trim() ?: ""
  }

  private fun readStringArray(payload: ReadableMap, key: String): Array<String> {
    if (!payload.hasKey(key) || payload.isNull(key)) return emptyArray()
    val rawArray = payload.getArray(key) ?: return emptyArray()
    val out = mutableListOf<String>()
    for (idx in 0 until rawArray.size()) {
      if (rawArray.getType(idx) != ReadableType.String) continue
      val value = rawArray.getString(idx)?.trim().orEmpty()
      if (value.isNotBlank()) out.add(value)
    }
    return out.toTypedArray()
  }

  private fun readableMapToJson(payload: ReadableMap): String {
    return try {
      readableMapToJsonObject(payload).toString()
    } catch (_: Throwable) {
      "{}"
    }
  }

  private fun readableMapToJsonObject(map: ReadableMap): JSONObject {
    val json = JSONObject()
    val iterator = map.keySetIterator()

    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      when (map.getType(key)) {
        ReadableType.String -> json.put(key, map.getString(key))
        ReadableType.Boolean -> json.put(key, map.getBoolean(key))
        ReadableType.Number -> json.put(key, map.getDouble(key))
        ReadableType.Map -> json.put(key, readableMapToJsonObject(map.getMap(key)!!))
        ReadableType.Array -> json.put(key, readableArrayToJsonArray(map.getArray(key)!!))
        ReadableType.Null -> json.put(key, JSONObject.NULL)
      }
    }

    return json
  }

  private fun readableArrayToJsonArray(array: com.facebook.react.bridge.ReadableArray): JSONArray {
    val json = JSONArray()
    for (index in 0 until array.size()) {
      when (array.getType(index)) {
        ReadableType.String -> json.put(array.getString(index))
        ReadableType.Boolean -> json.put(array.getBoolean(index))
        ReadableType.Number -> json.put(array.getDouble(index))
        ReadableType.Map -> json.put(readableMapToJsonObject(array.getMap(index)!!))
        ReadableType.Array -> json.put(readableArrayToJsonArray(array.getArray(index)!!))
        ReadableType.Null -> json.put(JSONObject.NULL)
      }
    }
    return json
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE_TRY_ON) return

    val promise = pendingPromise ?: return
    pendingPromise = null

    val status = data?.getStringExtra(WdpTryOnActivity.RESULT_STATUS) ?: "cancelled"
    val message = data?.getStringExtra(WdpTryOnActivity.RESULT_MESSAGE)
      ?: if (resultCode == Activity.RESULT_OK) "Native try-on completed." else "Native try-on cancelled."

    if (resultCode == Activity.RESULT_OK) {
      val response: WritableMap = Arguments.createMap().apply {
        putString("status", status)
        putString("message", message)
        putString("data", data?.getStringExtra(WdpTryOnActivity.RESULT_DATA) ?: "")
      }
      promise.resolve(response)
      return
    }

    promise.reject("E_TRYON_CANCELLED", message)
  }

  override fun onNewIntent(intent: Intent) {
    // no-op
  }

  override fun invalidate() {
    reactContext.removeActivityEventListener(this)
    pendingPromise = null
    super.invalidate()
  }
}
