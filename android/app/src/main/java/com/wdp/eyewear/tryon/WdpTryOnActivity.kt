package com.wdp.eyewear.tryon

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.SurfaceView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class WdpTryOnActivity : AppCompatActivity() {
  companion object {
    const val EXTRA_PRODUCT_ID = "wdp.tryon.extra.PRODUCT_ID"
    const val EXTRA_PRODUCT_NAME = "wdp.tryon.extra.PRODUCT_NAME"
    const val EXTRA_SDK_KEY = "wdp.tryon.extra.SDK_KEY"
    const val EXTRA_EFFECT_PATH = "wdp.tryon.extra.EFFECT_PATH"
    const val EXTRA_FALLBACK_URL = "wdp.tryon.extra.FALLBACK_URL"
    const val EXTRA_RESOURCE_PATHS = "wdp.tryon.extra.RESOURCE_PATHS"

    const val RESULT_STATUS = "wdp.tryon.result.STATUS"
    const val RESULT_MESSAGE = "wdp.tryon.result.MESSAGE"
    const val RESULT_EFFECT_PATH = "wdp.tryon.result.EFFECT_PATH"

    private const val CAMERA_PERMISSION_REQUEST_CODE = 8754
    private var isBanubaInitialized = false
  }

  private lateinit var surfaceView: SurfaceView
  private lateinit var statusLabel: TextView

  private var sdkManagerClass: Class<*>? = null
  private var sdkManager: Any? = null
  private var sessionStarted = false

  private val productId: String by lazy {
    intent?.getStringExtra(EXTRA_PRODUCT_ID)?.trim().orEmpty()
  }
  private val productName: String by lazy {
    intent?.getStringExtra(EXTRA_PRODUCT_NAME)?.trim().orEmpty()
  }
  private val sdkKey: String by lazy {
    intent?.getStringExtra(EXTRA_SDK_KEY)?.trim().orEmpty()
  }
  private val effectPath: String by lazy {
    intent?.getStringExtra(EXTRA_EFFECT_PATH)?.trim().orEmpty()
  }
  private val fallbackUrl: String by lazy {
    intent?.getStringExtra(EXTRA_FALLBACK_URL)?.trim().orEmpty()
  }
  private val resourcePaths: List<String> by lazy {
    val paths = intent?.getStringArrayListExtra(EXTRA_RESOURCE_PATHS) ?: arrayListOf()
    paths
      .map { normalizeBanubaPath(it.trim()) }
      .filter { it.isNotEmpty() }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setupUi()
    ensureCameraPermissionAndStart()
  }

  override fun onDestroy() {
    stopSession()
    super.onDestroy()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != CAMERA_PERMISSION_REQUEST_CODE) return

    val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
    if (granted) {
      startNativeTryOn()
    } else {
      finishFailure(
        code = "E_CAMERA_PERMISSION_DENIED",
        message = "Camera permission is required for native try-on."
      )
    }
  }

  private fun setupUi() {
    val root = FrameLayout(this)
    root.setBackgroundColor(0xFF000000.toInt())

    surfaceView = SurfaceView(this)
    root.addView(
      surfaceView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    )

    statusLabel = TextView(this).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 12f
      setPadding(24, 20, 24, 20)
      setBackgroundColor(0x66000000)
      text =
        buildString {
          append("Banuba AR session")
          append("\nProduct: ")
          append(if (productName.isNotEmpty()) productName else "N/A")
          append("\nProduct ID: ")
          append(if (productId.isNotEmpty()) productId else "N/A")
        }
    }

    val statusParams =
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      )
    root.addView(statusLabel, statusParams)

    val closeButton =
      Button(this).apply {
        text = "Close"
        setOnClickListener {
          finishCancelled("Native try-on closed by user.")
        }
      }

    val doneButton =
      Button(this).apply {
        text = "Done"
        setOnClickListener {
          finishSuccess(
            status = "completed",
            message = "Native Banuba try-on completed."
          )
        }
      }

    val actions =
      LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(24, 16, 24, 24)
        addView(
          closeButton,
          LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        addView(
          doneButton,
          LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            leftMargin = 12
          }
        )
      }

    val actionParams =
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = android.view.Gravity.BOTTOM
      }
    root.addView(actions, actionParams)

    setContentView(root)
  }

  private fun ensureCameraPermissionAndStart() {
    val hasCameraPermission =
      ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    if (hasCameraPermission) {
      startNativeTryOn()
      return
    }

    requestPermissions(
      arrayOf(Manifest.permission.CAMERA),
      CAMERA_PERMISSION_REQUEST_CODE
    )
  }

  private fun startNativeTryOn() {
    if (sessionStarted) return

    if (sdkKey.isEmpty()) {
      finishFailure(
        code = "E_MISSING_TOKEN",
        message = "Banuba token is missing."
      )
      return
    }

    if (effectPath.isEmpty()) {
      finishFailure(
        code = "E_MISSING_EFFECT_PATH",
        message = "Banuba native try-on requires a local effect path."
      )
      return
    }

    if (isHttpUrl(effectPath)) {
      if (fallbackUrl.isNotEmpty()) {
        openFallbackAndFinish("effectPath is a URL. Opening fallback URL instead.")
      } else {
        finishFailure(
          code = "E_INVALID_EFFECT_PATH",
          message = "effectPath must be a local Banuba effect path (for example: effects/my_effect)."
        )
      }
      return
    }

    try {
      val managerClass = Class.forName("com.banuba.sdk.manager.BanubaSdkManager")
      sdkManagerClass = managerClass

      if (!isBanubaInitialized) {
        val initializeMethod =
          managerClass.getMethod(
            "initialize",
            android.content.Context::class.java,
            String::class.java,
            Array<String>::class.java
          )
        initializeMethod.invoke(
          null,
          applicationContext,
          sdkKey,
          resourcePaths.toTypedArray()
        )
        isBanubaInitialized = true
      }

      val managerCtor = managerClass.getConstructor(android.content.Context::class.java)
      val managerInstance = managerCtor.newInstance(this)
      sdkManager = managerInstance

      managerClass.getMethod("attachSurface", SurfaceView::class.java)
        .invoke(managerInstance, surfaceView)
      managerClass.getMethod("openCamera").invoke(managerInstance)
      managerClass.getMethod("effectPlayerPlay").invoke(managerInstance)
      managerClass.getMethod("loadEffect", String::class.java, Boolean::class.javaPrimitiveType!!)
        .invoke(managerInstance, normalizeBanubaPath(effectPath), false)

      sessionStarted = true
      updateStatus("Effect: $effectPath")
    } catch (error: Throwable) {
      stopSession()
      if (fallbackUrl.isNotEmpty()) {
        openFallbackAndFinish(
          "Banuba native launch failed (${error.message}). Opening fallback URL."
        )
      } else {
        finishFailure(
          code = "E_NATIVE_LAUNCH_FAILED",
          message = error.message ?: "Banuba native launch failed."
        )
      }
    }
  }

  private fun stopSession() {
    val managerInstance = sdkManager ?: return
    val managerClass = sdkManagerClass ?: managerInstance.javaClass
    invokeNoArg(managerClass, managerInstance, "effectPlayerPause")
    invokeNoArg(managerClass, managerInstance, "closeCamera")
    invokeNoArg(managerClass, managerInstance, "clearSurface")
    invokeNoArg(managerClass, managerInstance, "releaseSurface")
    invokeNoArg(managerClass, managerInstance, "recycle")
    sdkManager = null
    sessionStarted = false
  }

  private fun invokeNoArg(managerClass: Class<*>, managerInstance: Any, methodName: String) {
    try {
      managerClass.getMethod(methodName).invoke(managerInstance)
    } catch (_: Throwable) {
      // Ignore optional cleanup method failures.
    }
  }

  private fun updateStatus(extraLine: String) {
    statusLabel.text =
      buildString {
        append("Banuba AR session")
        append("\nProduct: ")
        append(if (productName.isNotEmpty()) productName else "N/A")
        append("\nProduct ID: ")
        append(if (productId.isNotEmpty()) productId else "N/A")
        append("\n")
        append(extraLine)
      }
  }

  private fun openFallbackAndFinish(message: String) {
    try {
      val uri = Uri.parse(fallbackUrl)
      startActivity(Intent(Intent.ACTION_VIEW, uri))
      finishSuccess("fallback_opened", message)
    } catch (error: Throwable) {
      finishFailure(
        code = "E_FALLBACK_OPEN_FAILED",
        message = error.message ?: "Failed to open fallback URL."
      )
    }
  }

  private fun finishSuccess(status: String, message: String) {
    val resultIntent =
      Intent().apply {
        putExtra(RESULT_STATUS, status)
        putExtra(RESULT_MESSAGE, message)
        putExtra(RESULT_EFFECT_PATH, effectPath)
      }
    setResult(RESULT_OK, resultIntent)
    finish()
  }

  private fun finishCancelled(message: String) {
    val resultIntent =
      Intent().apply {
        putExtra(RESULT_STATUS, "cancelled")
        putExtra(RESULT_MESSAGE, message)
        putExtra(RESULT_EFFECT_PATH, effectPath)
      }
    setResult(RESULT_CANCELED, resultIntent)
    finish()
  }

  private fun finishFailure(code: String, message: String) {
    val resultIntent =
      Intent().apply {
        putExtra(RESULT_STATUS, "failed")
        putExtra(RESULT_MESSAGE, "$code: $message")
        putExtra(RESULT_EFFECT_PATH, effectPath)
      }
    setResult(RESULT_CANCELED, resultIntent)
    finish()
  }

  private fun isHttpUrl(value: String): Boolean {
    return value.startsWith("https://", ignoreCase = true) ||
      value.startsWith("http://", ignoreCase = true)
  }

  private fun normalizeBanubaPath(value: String): String {
    val trimmed = value.trim()
    if (!trimmed.startsWith("file://", ignoreCase = true)) return trimmed
    return Uri.parse(trimmed).path?.trim().orEmpty()
  }
}
