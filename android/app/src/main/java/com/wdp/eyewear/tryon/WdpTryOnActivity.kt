package com.wdp.eyewear.tryon

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Surface
import android.view.Gravity
import android.view.SurfaceHolder
import android.view.SurfaceView
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
  private lateinit var loadingOverlay: LinearLayout
  private lateinit var loadingLabel: TextView

  private val mainHandler = Handler(Looper.getMainLooper())

  private var sdkManagerClass: Class<*>? = null
  private var sdkManager: Any? = null
  private var sessionStarted = false
  private var cameraPermissionGranted = false
  private var surfaceReady = false
  private var surfaceFormat = 0
  private var surfaceWidth = 0
  private var surfaceHeight = 0

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

  override fun onResume() {
    super.onResume()
    mainHandler.postDelayed({ maybeStartNativeTryOn() }, 300)
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
      cameraPermissionGranted = true
      showLoading("Dang khoi dong camera...")
      mainHandler.postDelayed({ maybeStartNativeTryOn() }, 450)
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
    surfaceView.holder.addCallback(
      object : SurfaceHolder.Callback {
        override fun surfaceCreated(holder: SurfaceHolder) {
          surfaceReady = holder.surface?.isValid == true
          surfaceWidth = holder.surfaceFrame?.width() ?: surfaceView.width
          surfaceHeight = holder.surfaceFrame?.height() ?: surfaceView.height
          dispatchSurfaceCreated(holder)
          maybeStartNativeTryOn()
        }

        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
          surfaceFormat = format
          surfaceWidth = width
          surfaceHeight = height
          surfaceReady = holder.surface?.isValid == true && width > 0 && height > 0
          dispatchSurfaceChanged(format, width, height)
          maybeStartNativeTryOn()
        }

        override fun surfaceDestroyed(holder: SurfaceHolder) {
          surfaceReady = false
          surfaceWidth = 0
          surfaceHeight = 0
          dispatchSurfaceDestroyed()
        }
      }
    )
    root.addView(
      surfaceView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    )

    loadingLabel = TextView(this).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 14f
      gravity = Gravity.CENTER
      text = "Dang khoi dong AR..."
    }

    loadingOverlay =
      LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(0xCC000000.toInt())
        setPadding(32, 32, 32, 32)
        addView(
          loadingLabel,
          LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
          )
        )
      }
    root.addView(
      loadingOverlay,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    )

    val closeButton =
      TextView(this).apply {
        text = "X"
        gravity = Gravity.CENTER
        setTextColor(0xFFFFFFFF.toInt())
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        background =
          createRoundedDrawable(
            fillColor = 0x77000000,
            strokeColor = 0x22FFFFFF,
            cornerRadiusDp = 18f,
          )
        elevation = dp(6).toFloat()
        setOnClickListener {
          finishCancelled("Native try-on closed by user.")
        }
      }
    root.addView(
      closeButton,
      FrameLayout.LayoutParams(dp(52), dp(52)).apply {
        gravity = Gravity.TOP or Gravity.START
        topMargin = dp(20)
        leftMargin = dp(20)
      }
    )

    val bottomScrim =
      LinearLayout(this).apply {
        gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
        setPadding(dp(20), dp(24), dp(20), dp(30))
        background =
          GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(0x00000000, 0x99000000.toInt())
          )
      }

    val doneButton =
      TextView(this).apply {
        text = "Use This Look"
        gravity = Gravity.CENTER
        setTextColor(0xFF0F172A.toInt())
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        setPadding(dp(28), dp(16), dp(28), dp(16))
        background =
          createRoundedDrawable(
            fillColor = 0xFFF8FAFC.toInt(),
            strokeColor = 0x40FFFFFF,
            cornerRadiusDp = 24f,
          )
        elevation = dp(8).toFloat()
        setOnClickListener {
          finishSuccess(
            status = "completed",
            message = "Native Banuba try-on completed."
          )
        }
      }

    bottomScrim.addView(
      doneButton,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    )

    root.addView(
      bottomScrim,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.BOTTOM
      }
    )

    setContentView(root)
  }

  private fun ensureCameraPermissionAndStart() {
    cameraPermissionGranted =
      ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    if (cameraPermissionGranted) {
      showLoading("Dang khoi dong camera...")
      maybeStartNativeTryOn()
      return
    }

    showLoading("Can quyen camera de thu kinh...")
    requestPermissions(
      arrayOf(Manifest.permission.CAMERA),
      CAMERA_PERMISSION_REQUEST_CODE
    )
  }

  private fun maybeStartNativeTryOn() {
    if (sessionStarted || !cameraPermissionGranted || !surfaceReady) return
    if (surfaceWidth <= 0 || surfaceHeight <= 0) return
    startNativeTryOn()
  }

  private fun startNativeTryOn() {
    if (sessionStarted) return

    showLoading("Dang tai camera va effect...")

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

      configureTryOnCamera(managerClass, managerInstance)
      dispatchSurfaceCreated(surfaceView.holder)
      dispatchSurfaceChanged(surfaceFormat, surfaceWidth, surfaceHeight)
      managerClass.getMethod("openCamera").invoke(managerInstance)
      managerClass.getMethod("effectPlayerPlay").invoke(managerInstance)
      managerClass.getMethod("loadEffect", String::class.java, Boolean::class.javaPrimitiveType!!)
        .invoke(managerInstance, normalizeBanubaPath(effectPath), false)

      sessionStarted = true
      mainHandler.postDelayed({ hideLoading() }, 1200)
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
    mainHandler.removeCallbacksAndMessages(null)
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

  private fun showLoading(message: String) {
    if (!::loadingOverlay.isInitialized || !::loadingLabel.isInitialized) return
    loadingLabel.text = message
    loadingOverlay.visibility = android.view.View.VISIBLE
  }

  private fun hideLoading() {
    if (!::loadingOverlay.isInitialized) return
    loadingOverlay.visibility = android.view.View.GONE
  }

  private fun invokeNoArg(managerClass: Class<*>, managerInstance: Any, methodName: String) {
    try {
      managerClass.getMethod(methodName).invoke(managerInstance)
    } catch (_: Throwable) {
      // Ignore optional cleanup method failures.
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

  private fun dispatchSurfaceCreated(holder: SurfaceHolder) {
    val managerInstance = sdkManager ?: return
    val managerClass = sdkManagerClass ?: managerInstance.javaClass
    val surface = holder.surface ?: return
    if (!surface.isValid) return

    try {
      managerClass
        .getMethod("attachSurface", Surface::class.java)
        .invoke(managerInstance, surface)
    } catch (_: Throwable) {
      try {
        managerClass
          .getMethod("attachSurface", SurfaceView::class.java)
          .invoke(managerInstance, surfaceView)
      } catch (_: Throwable) {
        return
      }
    }

    invokeNoArg(managerClass, managerInstance, "onSurfaceCreated")
  }

  private fun dispatchSurfaceChanged(format: Int, width: Int, height: Int) {
    val managerInstance = sdkManager ?: return
    val managerClass = sdkManagerClass ?: managerInstance.javaClass
    if (width <= 0 || height <= 0) return

    try {
      managerClass
        .getMethod(
          "onSurfaceChanged",
          Int::class.javaPrimitiveType!!,
          Int::class.javaPrimitiveType!!,
          Int::class.javaPrimitiveType!!
        )
        .invoke(managerInstance, format, width, height)
    } catch (_: Throwable) {
      // Ignore unsupported callback forwarding.
    }
  }

  private fun dispatchSurfaceDestroyed() {
    val managerInstance = sdkManager ?: return
    val managerClass = sdkManagerClass ?: managerInstance.javaClass
    invokeNoArg(managerClass, managerInstance, "onSurfaceDestroyed")
  }

  private fun configureTryOnCamera(managerClass: Class<*>, managerInstance: Any) {
    try {
      val facingClass = Class.forName("com.banuba.sdk.camera.Facing")
      val frontFacing =
        facingClass.enumConstants?.firstOrNull { (it as? Enum<*>)?.name == "FRONT" }

      if (frontFacing != null) {
        try {
          managerClass
            .getMethod("setCameraFacing", facingClass, Boolean::class.javaPrimitiveType!!)
            .invoke(managerInstance, frontFacing, true)
        } catch (_: Throwable) {
          managerClass
            .getMethod("setCameraFacing", facingClass)
            .invoke(managerInstance, frontFacing)
        }
      }

      managerClass
        .getMethod("setRequireMirroring", Boolean::class.javaPrimitiveType!!)
        .invoke(managerInstance, true)
    } catch (_: Throwable) {
      // Ignore optional camera configuration failures and continue with SDK defaults.
    }
  }

  private fun createRoundedDrawable(
    fillColor: Int,
    strokeColor: Int,
    cornerRadiusDp: Float,
  ): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(cornerRadiusDp).toFloat()
      setColor(fillColor)
      setStroke(dp(1), strokeColor)
    }
  }

  private fun dp(value: Float): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      resources.displayMetrics
    ).toInt()
  }

  private fun dp(value: Int): Int {
    return dp(value.toFloat())
  }
}
