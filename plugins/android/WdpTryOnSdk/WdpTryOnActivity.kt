package __APP_PACKAGE__.tryon

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.SurfaceView
import android.util.TypedValue
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
  val fallbackUrl: String,
  val scene: String,
  val prefabJson: String
)

class WdpTryOnActivity : AppCompatActivity() {
  companion object {
    const val EXTRA_PRODUCT_ID = "wdp.tryon.extra.PRODUCT_ID"
    const val EXTRA_PRODUCT_NAME = "wdp.tryon.extra.PRODUCT_NAME"
    const val EXTRA_SDK_KEY = "wdp.tryon.extra.SDK_KEY"
    const val EXTRA_EFFECT_PATH = "wdp.tryon.extra.EFFECT_PATH"
    const val EXTRA_SCENE = "wdp.tryon.extra.SCENE"
    const val EXTRA_PREFAB_JSON = "wdp.tryon.extra.PREFAB_JSON"
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
  private val initialScene: String by lazy {
    intent?.getStringExtra(EXTRA_SCENE)?.trim().orEmpty()
  }
  private val initialPrefabJson: String by lazy {
    intent?.getStringExtra(EXTRA_PREFAB_JSON)?.trim().orEmpty()
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
          fallbackUrl = fallbackUrl,
          scene = initialScene,
          prefabJson = initialPrefabJson
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
      setPadding(dp(16), dp(16), dp(16), 0)
    }

    statusLabel = TextView(this).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 13f
      setPadding(dp(16), dp(12), dp(16), dp(12))
      // Đổi sang bo góc cho đồng bộ
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(16).toFloat()
        setColor(0x8F111827.toInt())
      }
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
        textSize = 14f
        text = "Switch model"
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(dp(4), dp(18), dp(4), dp(10))
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

    // Đã thay thế Button mặc định bằng TextView để tùy chỉnh UI dễ dàng
    val closeButton =
      TextView(this).apply {
        text = "Close"
        textSize = 14f
        gravity = Gravity.CENTER
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(0xFFFFFFFF.toInt())
        setPadding(0, dp(14), 0, dp(14))
        background = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = dp(16).toFloat()
          setColor(0x8F111827.toInt()) // Màu xám tối cho nút đóng
        }
        setOnClickListener {
          finishCancelled("Native try-on closed by user.")
        }
      }

    val doneButton =
      TextView(this).apply {
        text = "Done"
        textSize = 14f
        gravity = Gravity.CENTER
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(0xFFDDAD32.toInt()) // Màu Gold
        setPadding(0, dp(14), 0, dp(14))
        background = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = dp(16).toFloat()
          setColor(0xFF0C2C5C.toInt()) // Màu Navy
          setStroke(dp(1), 0xFFDDAD32.toInt()) // Viền mỏng màu Gold
        }
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
        setPadding(dp(24), dp(16), dp(24), dp(24)) // Sử dụng dp() thay vì số pixel cố định
        addView(
          closeButton,
          LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        addView(
          doneButton,
          LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            leftMargin = dp(12) // Cập nhật sang dp()
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

    // Định nghĩa các mã màu
    val colorNavy = 0xFF0C2C5C.toInt()      // Màu Navy
    val colorNavySoft = 0x8F0C2C5C.toInt()  // Màu Navy trong suốt (cho nút chưa chọn)
    val colorGold = 0xFFDDAD32.toInt()      // Màu Gold
    val colorWhite = 0xFFFFFFFF.toInt()     // Màu Trắng
    val colorDisabled = 0x665B6472.toInt()  // Màu xám khi not ready

    availableModels.forEach { model ->
      val isActive = activeModel?.id == model.id
      val button = TextView(this).apply {
        text = buildString {
          append(model.label)
          append("\n")
          append(if (model.ready) "Ready" else "Not ready")
        }
        textSize = 12f
        setLineSpacing(0f, 1.05f)
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        minWidth = dp(116)
        minHeight = dp(64)
        gravity = Gravity.CENTER
        
        // --- Set màu Text: Active là màu Gold, bình thường là màu Trắng ---
        setTextColor(if (isActive) colorGold else colorWhite)
        setPadding(dp(16), dp(12), dp(16), dp(12))

        // --- Tạo UI Bo góc (Background) ---
        val bgDrawable = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = dp(16).toFloat() // Bo góc 16dp
          
          // Set màu nền
          setColor(
            when {
              isActive -> colorNavy       // Nền Navy đậm khi được chọn
              model.ready -> colorNavySoft // Nền Navy nhạt khi sẵn sàng nhưng chưa chọn
              else -> colorDisabled       // Nền xám khi không ready
            }
          )
          
          // Thêm viền màu Gold mỏng khi được chọn cho nổi bật
          if (isActive) {
            setStroke(dp(1), colorGold)
          }
        }
        
        // Gán background đã bo góc cho TextView
        background = bgDrawable

        alpha = if (model.ready) 1f else 0.55f
        elevation = if (isActive) dp(4).toFloat() else 0f
        
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
          rightMargin = dp(10)
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
          val scene = item.optString("scene").trim()
          val ready = item.optBoolean("ready", effectPath.isNotEmpty())
          val modelFallbackUrl = item.optString("fallbackUrl").trim()
          val prefabJson = item.optJSONObject("prefab")?.toString()?.trim().orEmpty()

          if (!ready && effectPath.isBlank() && modelFallbackUrl.isBlank()) continue
          add(
            TryOnModelOption(
              id = id,
              label = label,
              effectPath = effectPath,
              ready = ready,
              fallbackUrl = modelFallbackUrl,
              scene = scene,
              prefabJson = prefabJson
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
      updateStatus("Đã chọn ${model.label}")
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
      updateStatus("Đang thử với ${model.label}")
    } catch (error: Throwable) {
      if (model.fallbackUrl.isNotEmpty()) {
        openFallbackAndFinish("Failed to switch model natively. Opening fallback URL instead.")
      } else {
        updateStatus("Không đổi được model. Vui lòng thử lại.")
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
        activeModel?.let { "Đang thử với ${it.label}" } ?: "Camera đã sẵn sàng"
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
    return extraLine.trim()
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

  private fun dp(value: Int): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value.toFloat(),
      resources.displayMetrics
    ).toInt()
  }
}