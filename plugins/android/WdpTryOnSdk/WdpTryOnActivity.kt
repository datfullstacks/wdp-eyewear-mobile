package __APP_PACKAGE__.tryon

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.SurfaceView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONArray

private data class TryOnModelOption(
  val id: String,
  val label: String,
  val effectPath: String,
  val ready: Boolean,
  val fallbackUrl: String
)

class WdpTryOnActivity : AppCompatActivity() {
  companion object {
    const val EXTRA_PRODUCT_ID = "wdp.tryon.extra.PRODUCT_ID"
    const val EXTRA_PRODUCT_NAME = "wdp.tryon.extra.PRODUCT_NAME"
    const val EXTRA_SDK_KEY = "wdp.tryon.extra.SDK_KEY"
    const val EXTRA_EFFECT_PATH = "wdp.tryon.extra.EFFECT_PATH"
    const val EXTRA_FALLBACK_URL = "wdp.tryon.extra.FALLBACK_URL"
    const val EXTRA_RESOURCE_PATHS = "wdp.tryon.extra.RESOURCE_PATHS"
    const val EXTRA_MODELS_JSON = "wdp.tryon.extra.MODELS_JSON"
    const val EXTRA_SELECTED_MODEL_ID = "wdp.tryon.extra.SELECTED_MODEL_ID"

    const val RESULT_STATUS = "wdp.tryon.result.STATUS"
    const val RESULT_MESSAGE = "wdp.tryon.result.MESSAGE"
    const val RESULT_EFFECT_PATH = "wdp.tryon.result.EFFECT_PATH"
    const val RESULT_MODEL_ID = "wdp.tryon.result.MODEL_ID"

    private const val CAMERA_PERMISSION_REQUEST_CODE = 8754
    private var isBanubaInitialized = false
  }

  private lateinit var surfaceView: SurfaceView
  private lateinit var statusLabel: TextView
  private lateinit var modelButtonsContainer: LinearLayout

  private var sdkManagerClass: Class<*>? = null
  private var sdkManager: Any? = null
  private var sessionStarted = false
  private var activeModel: TryOnModelOption? = null
  private var currentEffectPath: String = ""

  private val productId: String by lazy {
    intent?.getStringExtra(EXTRA_PRODUCT_ID)?.trim().orEmpty()
  }
  private val productName: String by lazy {
    intent?.getStringExtra(EXTRA_PRODUCT_NAME)?.trim().orEmpty()
  }
  private val sdkKey: String by lazy {
    intent?.getStringExtra(EXTRA_SDK_KEY)?.trim().orEmpty()
  }
  private val initialEffectPath: String by lazy {
    intent?.getStringExtra(EXTRA_EFFECT_PATH)?.trim().orEmpty()
  }
  private val fallbackUrl: String by lazy {
    intent?.getStringExtra(EXTRA_FALLBACK_URL)?.trim().orEmpty()
  }
  private val selectedModelId: String by lazy {
    intent?.getStringExtra(EXTRA_SELECTED_MODEL_ID)?.trim().orEmpty()
  }
  private val modelsJson: String by lazy {
    intent?.getStringExtra(EXTRA_MODELS_JSON)?.trim().orEmpty()
  }
  private val resourcePaths: List<String> by lazy {
    val paths = intent?.getStringArrayListExtra(EXTRA_RESOURCE_PATHS) ?: arrayListOf()
    paths
      .map { normalizeBanubaPath(it.trim()) }
      .filter { it.isNotEmpty() }
  }
  private val availableModels: List<TryOnModelOption> by lazy {
    val parsed = parseModelsJson(modelsJson)
    if (parsed.isNotEmpty()) parsed
    else if (initialEffectPath.isNotEmpty()) {
      listOf(
        TryOnModelOption(
          id = "default",
          label = if (productName.isNotEmpty()) productName else "Default",
          effectPath = initialEffectPath,
          ready = true,
          fallbackUrl = fallbackUrl
        )
      )
    } else {
      emptyList()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    activeModel = resolveInitialModel()
    currentEffectPath = activeModel?.effectPath ?: initialEffectPath
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

    val overlay = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24, 20, 24, 0)
    }

    statusLabel = TextView(this).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 12f
      setPadding(24, 20, 24, 20)
      setBackgroundColor(0x66000000)
      text = buildStatusText("Preparing native AR session...")
    }
    overlay.addView(
      statusLabel,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    )

    if (availableModels.size > 1) {
      val selectorLabel = TextView(this).apply {
        setTextColor(0xFFFFFFFF.toInt())
        textSize = 12f
        text = "Switch model"
        setPadding(4, 18, 4, 8)
      }
      overlay.addView(selectorLabel)

      val scrollView = HorizontalScrollView(this).apply {
        isHorizontalScrollBarEnabled = false
      }
      modelButtonsContainer = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
      }
      scrollView.addView(
        modelButtonsContainer,
        FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.WRAP_CONTENT,
          FrameLayout.LayoutParams.WRAP_CONTENT
        )
      )
      overlay.addView(
        scrollView,
        LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        )
      )
      renderModelButtons()
    } else {
      modelButtonsContainer = LinearLayout(this)
    }

    root.addView(
      overlay,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.TOP
      }
    )

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

    root.addView(
      actions,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.BOTTOM
      }
    )

    setContentView(root)
  }

  private fun renderModelButtons() {
    if (!::modelButtonsContainer.isInitialized) return
    modelButtonsContainer.removeAllViews()

    availableModels.forEach { model ->
      val isActive = activeModel?.id == model.id
      val button = TextView(this).apply {
        text = buildString {
          append(model.label)
          append("\n")
          append(if (model.ready) "Ready" else "Not ready")
        }
        textSize = 11f
        setTextColor(if (isActive) 0xFFDBEAFE.toInt() else 0xFFFFFFFF.toInt())
        setPadding(28, 18, 28, 18)
        setBackgroundColor(
          when {
            isActive -> 0xFF1D4ED8.toInt()
            model.ready -> 0x66000000
            else -> 0x44FFFFFF
          }
        )
        alpha = if (model.ready) 1f else 0.55f
        setOnClickListener {
          if (model.ready) switchToModel(model)
        }
      }

      modelButtonsContainer.addView(
        button,
        LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.WRAP_CONTENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
          rightMargin = 12
        }
      )
    }
  }

  private fun resolveInitialModel(): TryOnModelOption? {
    if (availableModels.isEmpty()) return null
    if (selectedModelId.isNotEmpty()) {
      availableModels.firstOrNull { it.id == selectedModelId }?.let { return it }
    }
    if (initialEffectPath.isNotEmpty()) {
      availableModels.firstOrNull { it.effectPath == initialEffectPath }?.let { return it }
    }
    return availableModels.firstOrNull { it.ready } ?: availableModels.first()
  }

  private fun parseModelsJson(raw: String): List<TryOnModelOption> {
    if (raw.isBlank()) return emptyList()

    return try {
      val json = JSONArray(raw)
      buildList {
        for (index in 0 until json.length()) {
          val item = json.optJSONObject(index) ?: continue
          val id = item.optString("id").trim().ifEmpty { "model-${index + 1}" }
          val label = item.optString("label").trim().ifEmpty { "Model ${index + 1}" }
          val effectPath = item.optString("effectPath").trim()
          val ready = item.optBoolean("ready", effectPath.isNotEmpty())
          val modelFallbackUrl = item.optString("fallbackUrl").trim()

          if (!ready && effectPath.isBlank() && modelFallbackUrl.isBlank()) continue
          add(
            TryOnModelOption(
              id = id,
              label = label,
              effectPath = effectPath,
              ready = ready,
              fallbackUrl = modelFallbackUrl
            )
          )
        }
      }
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun switchToModel(model: TryOnModelOption) {
    activeModel = model
    currentEffectPath = model.effectPath
    renderModelButtons()

    if (!sessionStarted) {
      updateStatus("Selected model: ${model.label}")
      return
    }

    val effectToLoad = currentEffectPath
    if (effectToLoad.isBlank()) {
      if (model.fallbackUrl.isNotEmpty()) {
        openFallbackAndFinish("Selected model does not have a local effect. Opening fallback URL instead.")
      } else {
        updateStatus("Selected model is not ready.")
      }
      return
    }

    try {
      val managerInstance = sdkManager ?: return
      val managerClass = sdkManagerClass ?: managerInstance.javaClass
      managerClass.getMethod("loadEffect", String::class.java, Boolean::class.javaPrimitiveType!!)
        .invoke(managerInstance, normalizeBanubaPath(effectToLoad), false)
      updateStatus("Model: ${model.label}\nEffect: $effectToLoad")
    } catch (error: Throwable) {
      if (model.fallbackUrl.isNotEmpty()) {
        openFallbackAndFinish("Failed to switch model natively. Opening fallback URL instead.")
      } else {
        updateStatus("Failed to switch model: ${error.message ?: "Unknown error"}")
      }
    }
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

    val effectToLoad = currentEffectPath.ifEmpty { initialEffectPath }

    if (effectToLoad.isEmpty()) {
      if (resolveActiveFallbackUrl().isNotEmpty()) {
        openFallbackAndFinish("effectPath is missing. Opening fallback URL instead.")
      } else {
        finishFailure(
          code = "E_MISSING_EFFECT_PATH",
          message = "Banuba native try-on requires a local effect path."
        )
      }
      return
    }

    if (isHttpUrl(effectToLoad)) {
      if (resolveActiveFallbackUrl().isNotEmpty()) {
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
        .invoke(managerInstance, normalizeBanubaPath(effectToLoad), false)

      sessionStarted = true
      currentEffectPath = effectToLoad
      updateStatus(
        buildString {
          append("Effect: ")
          append(effectToLoad)
          activeModel?.let {
            append("\nModel: ")
            append(it.label)
          }
        }
      )
    } catch (error: Throwable) {
      stopSession()
      if (resolveActiveFallbackUrl().isNotEmpty()) {
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

  private fun buildStatusText(extraLine: String): String {
    return buildString {
      append("Banuba AR session")
      append("\nProduct: ")
      append(if (productName.isNotEmpty()) productName else "N/A")
      append("\nProduct ID: ")
      append(if (productId.isNotEmpty()) productId else "N/A")
      activeModel?.let {
        append("\nModel: ")
        append(it.label)
      }
      append("\n")
      append(extraLine)
    }
  }

  private fun updateStatus(extraLine: String) {
    statusLabel.text = buildStatusText(extraLine)
  }

  private fun resolveActiveFallbackUrl(): String {
    val modelFallback = activeModel?.fallbackUrl?.trim().orEmpty()
    return if (modelFallback.isNotEmpty()) modelFallback else fallbackUrl
  }

  private fun openFallbackAndFinish(message: String) {
    val resolvedFallbackUrl = resolveActiveFallbackUrl()
    if (resolvedFallbackUrl.isEmpty()) {
      finishFailure(
        code = "E_FALLBACK_OPEN_FAILED",
        message = "Fallback URL is missing."
      )
      return
    }

    try {
      val uri = Uri.parse(resolvedFallbackUrl)
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
        putExtra(RESULT_EFFECT_PATH, currentEffectPath)
        putExtra(RESULT_MODEL_ID, activeModel?.id.orEmpty())
      }
    setResult(RESULT_OK, resultIntent)
    finish()
  }

  private fun finishCancelled(message: String) {
    val resultIntent =
      Intent().apply {
        putExtra(RESULT_STATUS, "cancelled")
        putExtra(RESULT_MESSAGE, message)
        putExtra(RESULT_EFFECT_PATH, currentEffectPath)
        putExtra(RESULT_MODEL_ID, activeModel?.id.orEmpty())
      }
    setResult(RESULT_CANCELED, resultIntent)
    finish()
  }

  private fun finishFailure(code: String, message: String) {
    val resultIntent =
      Intent().apply {
        putExtra(RESULT_STATUS, "failed")
        putExtra(RESULT_MESSAGE, "$code: $message")
        putExtra(RESULT_EFFECT_PATH, currentEffectPath.ifEmpty { initialEffectPath })
        putExtra(RESULT_MODEL_ID, activeModel?.id.orEmpty())
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
