package com.anonymous.WDP301_Mobile

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.Gravity
import android.view.SurfaceView
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.banuba.sdk.camera.Facing
import com.banuba.sdk.manager.BanubaSdkManager
import com.banuba.sdk.manager.BanubaSdkTouchListener

class WdpTryOnActivity : AppCompatActivity() {

  companion object {
    const val EXTRA_PRODUCT_ID = "wdp_tryon_product_id"
    const val EXTRA_PRODUCT_NAME = "wdp_tryon_product_name"
    const val EXTRA_SDK_KEY = "wdp_tryon_sdk_key"
    const val EXTRA_EFFECT_PATH = "wdp_tryon_effect_path"
    const val EXTRA_RESOURCE_PATHS = "wdp_tryon_resource_paths"
    const val EXTRA_MODEL_URL = "wdp_tryon_model_url"
    const val EXTRA_GLB_URL = "wdp_tryon_glb_url"
    const val EXTRA_USDZ_URL = "wdp_tryon_usdz_url"
    const val EXTRA_AR_URL = "wdp_tryon_ar_url"
    const val EXTRA_FALLBACK_URL = "wdp_tryon_fallback_url"
    const val EXTRA_PAYLOAD_JSON = "wdp_tryon_payload_json"

    const val RESULT_STATUS = "status"
    const val RESULT_MESSAGE = "message"
    const val RESULT_DATA = "data"

    private const val REQUEST_CODE_PERMISSIONS = 4101
    private const val DEFAULT_DEMO_EFFECT = "effects/test_TeethTone"
  }

  private lateinit var surfaceView: SurfaceView
  private lateinit var statusView: TextView

  private var sdkManager: BanubaSdkManager? = null
  private var initialized = false

  private val productName: String by lazy { intent.getStringExtra(EXTRA_PRODUCT_NAME).orEmpty() }
  private val productId: String by lazy { intent.getStringExtra(EXTRA_PRODUCT_ID).orEmpty() }
  private val effectPath: String by lazy { intent.getStringExtra(EXTRA_EFFECT_PATH).orEmpty() }
  private val resourcePaths: Array<String> by lazy {
    intent.getStringArrayExtra(EXTRA_RESOURCE_PATHS) ?: emptyArray()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    setupUi()

    val startError = startBanuba()
    if (startError != null) {
      finishWithCancel(startError)
      return
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        finishWithCancel("Native Banuba try-on closed by system back.")
      }
    })
  }

  override fun onResume() {
    super.onResume()
    sdkManager?.effectPlayerPlay()
  }

  override fun onPause() {
    sdkManager?.effectPlayerPause()
    super.onPause()
  }

  override fun onDestroy() {
    sdkManager?.closeCamera()
    sdkManager = null
    if (initialized) {
      BanubaSdkManager.deinitialize()
      initialized = false
    }
    super.onDestroy()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != REQUEST_CODE_PERMISSIONS) return
    if (!hasAllPermissions()) {
      finishWithCancel("Camera and microphone permissions are required for try-on.")
      return
    }
    openCameraAndPlay()
  }

  private fun setupUi() {
    val root = FrameLayout(this)

    surfaceView = SurfaceView(this)
    root.addView(
      surfaceView,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24, 24, 24, 24)
      gravity = Gravity.TOP
    }

    statusView = TextView(this).apply {
      text =
        "Banuba AR session\nProduct: ${if (productName.isNotBlank()) productName else "N/A"}" +
          "\nProduct ID: ${if (productId.isNotBlank()) productId else "N/A"}"
      setTextColor(0xFFFFFFFF.toInt())
      setBackgroundColor(0x66000000)
      setPadding(16, 12, 16, 12)
    }

    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, 16, 0, 0)
      gravity = Gravity.CENTER_HORIZONTAL
    }

    val doneButton = Button(this).apply {
      text = "Done"
      setOnClickListener {
        finishWithSuccess(
          status = "completed",
          message = "Native Banuba try-on completed."
        )
      }
    }

    val closeButton = Button(this).apply {
      text = "Close"
      setOnClickListener {
        finishWithCancel("Native Banuba try-on closed by user.")
      }
    }

    actions.addView(doneButton)
    actions.addView(closeButton)
    controls.addView(statusView)
    controls.addView(actions)

    root.addView(
      controls,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP
      )
    )

    setContentView(root)
  }

  private fun startBanuba(): String? {
    if (!BuildConfig.BANUBA_ENABLED) {
      return "Banuba is disabled. Set BANUBA_ENABLED=true in gradle properties or environment."
    }

    val token = resolveLicenseToken()
    if (token.isBlank()) {
      return "Banuba token is missing. Configure BANUBA_LICENSE_TOKEN."
    }

    try {
      if (resourcePaths.isNotEmpty()) {
        BanubaSdkManager.initialize(applicationContext, token, *resourcePaths)
      } else {
        BanubaSdkManager.initialize(applicationContext, token)
      }
      initialized = true

      val manager = BanubaSdkManager(applicationContext)
      manager.attachSurface(surfaceView)
      manager.onSurfaceCreated()
      surfaceView.post {
        manager.onSurfaceChanged(0, surfaceView.width, surfaceView.height)
      }

      surfaceView.setOnTouchListener(
        BanubaSdkTouchListener(applicationContext, manager.effectPlayer)
      )

      sdkManager = manager
      openCameraAndPlay()
      loadConfiguredEffect()

      return null
    } catch (error: Throwable) {
      return error.message ?: "Failed to initialize Banuba SDK."
    }
  }

  private fun resolveLicenseToken(): String {
    val buildToken = BuildConfig.BANUBA_LICENSE_TOKEN.trim()
    if (buildToken.isNotBlank()) return buildToken
    return intent.getStringExtra(EXTRA_SDK_KEY)?.trim().orEmpty()
  }

  private fun openCameraAndPlay() {
    if (!hasAllPermissions()) {
      requestCameraPermissions()
      return
    }

    try {
      sdkManager?.setCameraFacing(Facing.FRONT)
      sdkManager?.openCamera()
      sdkManager?.effectPlayerPlay()
    } catch (error: Throwable) {
      finishWithCancel(error.message ?: "Failed to open Banuba camera.")
    }
  }

  private fun loadConfiguredEffect() {
    val targetEffect = when {
      effectPath.isNotBlank() -> effectPath
      else -> DEFAULT_DEMO_EFFECT
    }

    try {
      sdkManager?.loadEffect(targetEffect, true)
      statusView.text =
        statusView.text.toString() + "\nEffect: $targetEffect"
    } catch (_: Throwable) {
      statusView.text =
        statusView.text.toString() + "\nEffect unavailable: $targetEffect"
    }
  }

  private fun hasAllPermissions(): Boolean {
    return hasPermission(Manifest.permission.CAMERA) &&
      hasPermission(Manifest.permission.RECORD_AUDIO)
  }

  private fun hasPermission(permission: String): Boolean {
    return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
  }

  private fun requestCameraPermissions() {
    ActivityCompat.requestPermissions(
      this,
      arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
      REQUEST_CODE_PERMISSIONS
    )
  }

  private fun finishWithSuccess(status: String, message: String) {
    val result = Intent().apply {
      putExtra(RESULT_STATUS, status)
      putExtra(RESULT_MESSAGE, message)
      putExtra(RESULT_DATA, intent.getStringExtra(EXTRA_PAYLOAD_JSON).orEmpty())
    }
    setResult(Activity.RESULT_OK, result)
    finish()
  }

  private fun finishWithCancel(message: String) {
    val result = Intent().apply {
      putExtra(RESULT_STATUS, "cancelled")
      putExtra(RESULT_MESSAGE, message)
    }
    setResult(Activity.RESULT_CANCELED, result)
    finish()
  }
}
