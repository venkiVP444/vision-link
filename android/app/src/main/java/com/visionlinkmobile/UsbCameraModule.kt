package com.visionlinkmobile

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.hardware.camera2.*
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.media.Image
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.util.Size
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.herohan.uvcapp.CameraException
import com.herohan.uvcapp.CameraHelper
import com.herohan.uvcapp.ICameraHelper
import com.serenegiant.usb.IFrameCallback
import com.serenegiant.usb.Size as UvcSize
import com.serenegiant.usb.UVCCamera
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class UsbCameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "UsbCamera"
        private const val DEFAULT_WIDTH = 640
        private const val DEFAULT_HEIGHT = 480
        private const val ACTION_USB_PERMISSION = "com.visionlinkmobile.USB_PERMISSION"

        @Volatile
        private var activeInstance: UsbCameraModule? = null

        fun onDeviceAttachedFromIntent(device: UsbDevice) {
            Log.i(TAG, "[OTG] onDeviceAttachedFromIntent invoked: ${device.deviceName}")
            activeInstance?.handleDirectDeviceAttached(device)
        }
    }

    override fun getName(): String = "UsbCameraModule"

    private val usbManager: UsbManager by lazy {
        reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
    }

    private val cameraManager: CameraManager by lazy {
        reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    }

    private var cameraStatus: String = "disconnected"
    private var activeDeviceInfo: WritableMap? = null

    @Volatile
    private var latestFrameBase64: String? = null
    @Volatile
    private var latestFrameTimestamp: Long = 0L
    @Volatile
    private var latestFrameSequence: Long = 0L
    @Volatile
    private var latestFrameWidth: Int = DEFAULT_WIDTH
    @Volatile
    private var latestFrameHeight: Int = DEFAULT_HEIGHT

    private var lastDeliveredSequence: Long = 0L

    // UVC Direct USB Engine
    private var cameraHelper: CameraHelper? = null
    private val isEncodingUvcFrame = AtomicBoolean(false)

    // Camera2 fallback engine (for platforms with External Camera HAL)
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    private val isStreaming = AtomicBoolean(false)
    private var isReceiverRegistered = false
    private var isAvailabilityCallbackRegistered = false

    private fun initCameraHelper() {
        try {
            cameraHelper = CameraHelper().apply {
                setStateCallback(object : ICameraHelper.StateCallback {
                    override fun onAttach(device: UsbDevice) {
                        Log.i(TAG, "[UVC] CameraHelper onAttach: ${device.deviceName} (VID: 0x${Integer.toHexString(device.vendorId)}, PID: 0x${Integer.toHexString(device.productId)})")
                        if (usbManager.hasPermission(device)) {
                            handleCameraConnected(device)
                            try {
                                selectDevice(device)
                            } catch (e: Exception) {
                                Log.e(TAG, "[UVC] Error selecting device on attach", e)
                            }
                        } else {
                            requestUsbPermission(device)
                        }
                    }

                    override fun onDeviceOpen(device: UsbDevice, isFirstOpen: Boolean) {
                        Log.i(TAG, "[UVC] CameraHelper onDeviceOpen: ${device.deviceName}, isFirstOpen: $isFirstOpen")
                        try {
                            val sizes = supportedSizeList ?: emptyList()
                            Log.i(TAG, "[UVC] Supported sizes count: ${sizes.size}")
                            val chosenSize = sizes.firstOrNull { it.width == DEFAULT_WIDTH && it.height == DEFAULT_HEIGHT }
                                ?: sizes.firstOrNull { it.width == 320 && it.height == 240 }
                                ?: sizes.firstOrNull()
                            if (chosenSize != null) {
                                Log.i(TAG, "[UVC] Setting preview size: ${chosenSize.width}x${chosenSize.height}")
                                previewSize = chosenSize
                            }
                            openCamera()
                        } catch (e: Exception) {
                            Log.e(TAG, "[UVC] Error in onDeviceOpen openCamera", e)
                        }
                    }

                    override fun onCameraOpen(device: UsbDevice) {
                        Log.i(TAG, "[UVC] CameraHelper onCameraOpen: ${device.deviceName}")
                        try {
                            setFrameCallback({ buffer ->
                                processUvcFrame(buffer)
                            }, UVCCamera.PIXEL_FORMAT_NV21)
                            startPreview()
                            isStreaming.set(true)
                            cameraStatus = "streaming"
                            emitStatusChanged(cameraStatus)
                            Log.i(TAG, "[UVC] Live UVC streaming preview started successfully via CameraHelper")
                        } catch (e: Exception) {
                            Log.e(TAG, "[UVC] Error starting preview on camera open", e)
                        }
                    }

                    override fun onCameraClose(device: UsbDevice) {
                        Log.i(TAG, "[UVC] CameraHelper onCameraClose")
                        isStreaming.set(false)
                    }

                    override fun onDeviceClose(device: UsbDevice) {
                        Log.i(TAG, "[UVC] CameraHelper onDeviceClose")
                    }

                    override fun onDetach(device: UsbDevice) {
                        Log.i(TAG, "[UVC] CameraHelper onDetach: ${device.deviceName}")
                        handleCameraDisconnected()
                    }

                    override fun onCancel(device: UsbDevice) {
                        Log.w(TAG, "[UVC] CameraHelper onCancel (permission denied)")
                        cameraStatus = "permission_denied"
                        emitStatusChanged(cameraStatus)
                    }

                    override fun onError(device: UsbDevice, e: CameraException) {
                        Log.e(TAG, "[UVC] CameraHelper onError: ${e.message}", e)
                    }
                })
            }
            Log.i(TAG, "[UVC] Native UVC CameraHelper initialized")
        } catch (e: Exception) {
            Log.e(TAG, "[UVC] Failed to initialize CameraHelper", e)
        }
    }

    private fun processUvcFrame(frame: ByteBuffer) {
        if (!isEncodingUvcFrame.compareAndSet(false, true)) {
            return // Skip frame if previous frame is still encoding
        }
        try {
            val now = SystemClock.elapsedRealtime()
            val len = frame.remaining()
            if (len <= 0) return

            val pSize = cameraHelper?.previewSize
            val w = pSize?.width ?: DEFAULT_WIDTH
            val h = pSize?.height ?: DEFAULT_HEIGHT
            val expectedLen = w * h * 3 / 2

            val nv21Bytes = if (len >= expectedLen) {
                val bytes = ByteArray(expectedLen)
                frame.get(bytes, 0, expectedLen)
                bytes
            } else {
                val bytes = ByteArray(len)
                frame.get(bytes)
                bytes
            }

            if (nv21Bytes.size >= expectedLen) {
                val yuvImage = YuvImage(nv21Bytes, ImageFormat.NV21, w, h, null)
                val out = ByteArrayOutputStream()
                yuvImage.compressToJpeg(Rect(0, 0, w, h), 85, out)
                val jpegBytes = out.toByteArray()

                if (jpegBytes.isNotEmpty()) {
                    latestFrameSequence++
                    val currentSeq = latestFrameSequence
                    latestFrameTimestamp = now
                    latestFrameWidth = w
                    latestFrameHeight = h

                    val b64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
                    latestFrameBase64 = "data:image/jpeg;base64,$b64"

                    Log.i(TAG, "[UVC] Frame received seq=$currentSeq ${w}x${h} format=NV21 timestamp=$now")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[UVC] Error processing acquired UVC frame", e)
        } finally {
            isEncodingUvcFrame.set(false)
        }
    }

    fun handleDirectDeviceAttached(device: UsbDevice) {
        if (!isVideoDevice(device)) return
        Log.i(TAG, "[OTG] Handling direct attached device from intent: ${device.deviceName} (Vendor: 0x${Integer.toHexString(device.vendorId)}, Product: 0x${Integer.toHexString(device.productId)})")
        if (usbManager.hasPermission(device)) {
            handleCameraConnected(device)
            try {
                cameraHelper?.selectDevice(device)
            } catch (e: Exception) {
                Log.e(TAG, "[UVC] Error selecting device on direct attached", e)
            }
            openCameraHardware()
        } else {
            requestUsbPermission(device)
        }
    }

    private fun requestUsbPermission(device: UsbDevice) {
        if (usbManager.hasPermission(device)) {
            handleCameraConnected(device)
            try {
                cameraHelper?.selectDevice(device)
            } catch (e: Exception) {
                Log.e(TAG, "[UVC] Error selecting device in requestUsbPermission", e)
            }
            openCameraHardware()
            return
        }

        Log.i(TAG, "[OTG] Requesting USB permission for ${device.deviceName} (Vendor: 0x${Integer.toHexString(device.vendorId)}, Product: 0x${Integer.toHexString(device.productId)})")
        cameraStatus = "permission_required"
        emitStatusChanged(cameraStatus)
        val intent = Intent(ACTION_USB_PERMISSION).apply {
            setPackage(reactContext.packageName)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val permissionIntent = PendingIntent.getBroadcast(
            reactContext,
            0,
            intent,
            flags
        )
        usbManager.requestPermission(device, permissionIntent)
    }

    private val cameraAvailabilityCallback = object : CameraManager.AvailabilityCallback() {
        override fun onCameraAvailable(cameraId: String) {
            super.onCameraAvailable(cameraId)
            Log.i(TAG, "[OTG] Camera available reported by CameraManager: $cameraId")
            try {
                val chars = cameraManager.getCameraCharacteristics(cameraId)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                    Log.i(TAG, "[OTG] External camera hardware ready in Camera2: $cameraId")
                    if (cameraStatus != "streaming" && isConnectedUsbDevicePresent()) {
                        openCameraHardware()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "[OTG] Error inspecting available camera $cameraId", e)
            }
        }

        override fun onCameraUnavailable(cameraId: String) {
            super.onCameraUnavailable(cameraId)
            Log.i(TAG, "[OTG] Camera unavailable: $cameraId")
            if (cameraDevice?.id == cameraId) {
                Log.w(TAG, "[OTG] Active camera became unavailable: $cameraId")
                handleCameraDisconnected()
            }
        }
    }

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            @Suppress("DEPRECATION")
            val device: UsbDevice? = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)

            Log.i(TAG, "[OTG] USB Broadcast action: $action, device: ${device?.deviceName}")

            when (action) {
                ACTION_USB_PERMISSION -> {
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    Log.i(TAG, "[OTG] USB Permission broadcast: device=${device?.deviceName}, granted=$granted")
                    if (granted && device != null) {
                        handleCameraConnected(device)
                        try {
                            cameraHelper?.selectDevice(device)
                        } catch (e: Exception) {
                            Log.e(TAG, "[UVC] Error selecting device after permission", e)
                        }
                        openCameraHardware()
                    } else {
                        Log.w(TAG, "[OTG] USB Permission denied for device: ${device?.deviceName}")
                        cameraStatus = "permission_denied"
                        activeDeviceInfo = null
                        emitStatusChanged(cameraStatus)
                    }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    if (device != null && isVideoDevice(device)) {
                        Log.i(TAG, "[OTG] UVC Camera connected: ${device.deviceName} (Vendor: 0x${Integer.toHexString(device.vendorId)}, Product: 0x${Integer.toHexString(device.productId)})")
                        if (usbManager.hasPermission(device)) {
                            handleCameraConnected(device)
                            try {
                                cameraHelper?.selectDevice(device)
                            } catch (e: Exception) {
                                Log.e(TAG, "[UVC] Error selecting device on attached", e)
                            }
                            openCameraHardware()
                        } else {
                            requestUsbPermission(device)
                        }
                    }
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    if (device != null && isVideoDevice(device)) {
                        Log.i(TAG, "[OTG] UVC Camera detached: ${device.deviceName}")
                        handleCameraDisconnected()
                    } else if (getConnectedVideoDevice() == null) {
                        Log.i(TAG, "[OTG] No remaining video devices attached. Disconnecting camera.")
                        handleCameraDisconnected()
                    }
                }
            }
        }
    }

    init {
        activeInstance = this
        registerUsbReceiver()
        registerAvailabilityCallback()
        initCameraHelper()
        checkInitialUsbState()
    }

    private fun registerUsbReceiver() {
        if (isReceiverRegistered) return
        try {
            val filter = IntentFilter().apply {
                addAction(ACTION_USB_PERMISSION)
                addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
                addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(usbReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                reactContext.registerReceiver(usbReceiver, filter)
            }
            isReceiverRegistered = true
            Log.i(TAG, "[OTG] Registered USB Device Attached/Detached BroadcastReceiver")
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to register USB BroadcastReceiver", e)
        }
    }

    private fun registerAvailabilityCallback() {
        if (isAvailabilityCallbackRegistered) return
        try {
            startBackgroundThread()
            cameraManager.registerAvailabilityCallback(cameraAvailabilityCallback, backgroundHandler)
            isAvailabilityCallbackRegistered = true
            Log.i(TAG, "[OTG] Registered CameraManager.AvailabilityCallback")
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to register CameraManager availability callback", e)
        }
    }

    private fun isVideoDevice(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_VIDEO) {
            return true
        }
        // Match specific known OTG UVC cameras (e.g. Geek szitman supercamera 0x349c:0x8319 / 0x2ce3:0x3828)
        if (device.vendorId == 0x349c && device.productId == 0x8319) {
            return true
        }
        if (device.vendorId == 0x2ce3 && device.productId == 0x3828) {
            return true
        }
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == UsbConstants.USB_CLASS_VIDEO) {
                return true
            }
        }
        return false
    }

    private fun isConnectedUsbDevicePresent(): Boolean {
        return getConnectedVideoDevice() != null
    }

    private fun getConnectedVideoDevice(): UsbDevice? {
        val deviceList = usbManager.deviceList
        for ((_, device) in deviceList) {
            if (isVideoDevice(device)) {
                return device
            }
        }
        return null
    }

    private fun checkInitialUsbState() {
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            if (usbManager.hasPermission(uvcDevice)) {
                handleCameraConnected(uvcDevice)
                try {
                    cameraHelper?.selectDevice(uvcDevice)
                } catch (e: Exception) {
                    Log.e(TAG, "[UVC] Error selecting initial device", e)
                }
                openCameraHardware()
            } else {
                requestUsbPermission(uvcDevice)
            }
        } else {
            cameraStatus = "disconnected"
        }
    }

    private fun handleCameraConnected(device: UsbDevice) {
        val prodName = device.productName ?: ""
        val friendlyName = if (prodName.contains("supercamera", ignoreCase = true)) {
            "Vision-Link OTG Camera ($prodName)"
        } else if (prodName.isNotBlank()) {
            prodName
        } else {
            device.deviceName ?: "USB UVC Camera"
        }

        cameraStatus = "connected"
        activeDeviceInfo = Arguments.createMap().apply {
            putString("id", "usb_${device.vendorId}_${device.productId}")
            putString("name", friendlyName)
            putInt("vendorId", device.vendorId)
            putInt("productId", device.productId)
            putBoolean("isUvcCompatible", true)
            putString("resolution", "${DEFAULT_WIDTH}x${DEFAULT_HEIGHT} @ 30fps")
        }
        emitStatusChanged(cameraStatus)
    }

    private fun handleCameraDisconnected() {
        Log.i(TAG, "[OTG] Cleaning up live inference and frame capture on camera disconnect")
        stopCameraCapture()
        cameraStatus = "disconnected"
        activeDeviceInfo = null
        latestFrameBase64 = null
        latestFrameTimestamp = 0L
        latestFrameSequence = 0L
        lastDeliveredSequence = 0L
        emitStatusChanged(cameraStatus)
    }

    private fun emitStatusChanged(status: String) {
        try {
            if (reactContext.hasActiveReactInstance()) {
                val params = Arguments.createMap().apply {
                    putString("status", status)
                    if (activeDeviceInfo != null) {
                        putMap("device", activeDeviceInfo)
                    }
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onCameraStatusChanged", params)
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to emit status change event", e)
        }
    }

    private fun startBackgroundThread() {
        if (backgroundThread == null) {
            backgroundThread = HandlerThread("UsbCameraBackground").apply {
                start()
                backgroundHandler = Handler(looper)
            }
        }
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join(500)
        } catch (_: Exception) {}
        backgroundThread = null
        backgroundHandler = null
    }

    private fun yuv420ToNv21(image: Image): ByteArray {
        val crop = image.cropRect
        val width = crop.width()
        val height = crop.height()
        val planes = image.planes
        val nv21 = ByteArray(width * height * 3 / 2)

        val yBuffer = planes[0].buffer
        val uBuffer = planes[1].buffer
        val vBuffer = planes[2].buffer

        val yRowStride = planes[0].rowStride
        val yPixelStride = planes[0].pixelStride
        val uRowStride = planes[1].rowStride
        val vRowStride = planes[2].rowStride
        val uPixelStride = planes[1].pixelStride
        val vPixelStride = planes[2].pixelStride

        var pos = 0
        val yLimit = yBuffer.limit()

        for (row in 0 until height) {
            val rowStart = (crop.top + row) * yRowStride + crop.left * yPixelStride
            if (yPixelStride == 1) {
                val len = width.coerceAtMost((yLimit - rowStart).coerceAtLeast(0))
                if (len > 0) {
                    yBuffer.position(rowStart)
                    yBuffer.get(nv21, pos, len)
                    pos += len
                }
            } else {
                for (col in 0 until width) {
                    val idx = rowStart + col * yPixelStride
                    if (idx < yLimit) {
                        nv21[pos++] = yBuffer.get(idx)
                    }
                }
            }
        }

        val uvWidth = width / 2
        val uvHeight = height / 2
        val uLimit = uBuffer.limit()
        val vLimit = vBuffer.limit()

        for (row in 0 until uvHeight) {
            val uRowStart = (crop.top / 2 + row) * uRowStride + (crop.left / 2) * uPixelStride
            val vRowStart = (crop.top / 2 + row) * vRowStride + (crop.left / 2) * vPixelStride

            for (col in 0 until uvWidth) {
                val uIdx = uRowStart + col * uPixelStride
                val vIdx = vRowStart + col * vPixelStride

                if (vIdx < vLimit) {
                    nv21[pos++] = vBuffer.get(vIdx)
                }
                if (uIdx < uLimit) {
                    nv21[pos++] = uBuffer.get(uIdx)
                }
            }
        }

        return nv21
    }

    private fun findExternalCameraId(): String? {
        try {
            val cameraIds = cameraManager.cameraIdList
            Log.i(TAG, "[OTG] Camera2 detected camera IDs: ${cameraIds.joinToString()}")

            for (id in cameraIds) {
                val chars = cameraManager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                    Log.i(TAG, "[OTG] Found external camera by LENS_FACING_EXTERNAL: $id")
                    return id
                }
            }

            for (id in cameraIds) {
                if (id.contains("external", ignoreCase = true)) {
                    Log.i(TAG, "[OTG] Found external camera by ID name: $id")
                    return id
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Error finding external camera ID", e)
        }
        return null
    }

    @SuppressLint("MissingPermission")
    private fun openCameraHardware(): Boolean {
        // Priority 1: Direct USB UVC Camera via CameraHelper
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            Log.i(TAG, "[UVC] Starting direct UVC stream for attached device: ${uvcDevice.deviceName}")
            try {
                cameraHelper?.selectDevice(uvcDevice)
                if (cameraHelper?.isCameraOpened == true) {
                    cameraHelper?.startPreview()
                    isStreaming.set(true)
                    cameraStatus = "streaming"
                    emitStatusChanged(cameraStatus)
                    return true
                }
                // selectDevice triggered async connect callback
                isStreaming.set(true)
                cameraStatus = "streaming"
                emitStatusChanged(cameraStatus)
                return true
            } catch (e: Exception) {
                Log.e(TAG, "[UVC] Error launching CameraHelper stream", e)
            }
        }

        // Priority 2: Camera2 External Camera HAL (if supported by device OS)
        try {
            startBackgroundThread()

            val selectedCameraId = findExternalCameraId()
            if (selectedCameraId == null) {
                Log.i(TAG, "[OTG] No Camera2 external HAL found (handled via direct UVC).")
                return uvcDevice != null
            }

            val chars = cameraManager.getCameraCharacteristics(selectedCameraId)
            val configMap = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val supportedFormats = configMap?.outputFormats ?: intArrayOf()

            val chosenFormat = if (supportedFormats.contains(ImageFormat.YUV_420_888)) {
                ImageFormat.YUV_420_888
            } else if (supportedFormats.contains(ImageFormat.JPEG)) {
                ImageFormat.JPEG
            } else {
                ImageFormat.YUV_420_888
            }

            val availableSizes = configMap?.getOutputSizes(chosenFormat) ?: emptyArray()
            val chosenSize = availableSizes.firstOrNull { it.width == 320 && it.height == 240 }
                ?: availableSizes.firstOrNull { it.width == 640 && it.height == 480 }
                ?: availableSizes.minByOrNull { it.width * it.height }
                ?: Size(DEFAULT_WIDTH, DEFAULT_HEIGHT)

            val streamWidth = chosenSize.width
            val streamHeight = chosenSize.height
            Log.i(TAG, "[OTG] Configured Camera2 preview reader: format=$chosenFormat, size=${streamWidth}x${streamHeight}")

            imageReader?.close()
            imageReader = ImageReader.newInstance(streamWidth, streamHeight, chosenFormat, 3).apply {
                setOnImageAvailableListener({ reader ->
                    val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                    try {
                        val w = image.width
                        val h = image.height
                        val now = SystemClock.elapsedRealtime()

                        val jpegBytes = if (image.format == ImageFormat.JPEG || image.planes.size == 1) {
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            bytes
                        } else {
                            val nv21 = yuv420ToNv21(image)
                            val yuvImage = YuvImage(nv21, ImageFormat.NV21, w, h, null)
                            val out = ByteArrayOutputStream()
                            yuvImage.compressToJpeg(Rect(0, 0, w, h), 85, out)
                            out.toByteArray()
                        }

                        if (jpegBytes.isNotEmpty()) {
                            latestFrameSequence++
                            val currentSeq = latestFrameSequence
                            latestFrameTimestamp = now
                            latestFrameWidth = w
                            latestFrameHeight = h

                            val b64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
                            latestFrameBase64 = "data:image/jpeg;base64,$b64"

                            Log.i(TAG, "[UVC] Frame received seq=$currentSeq ${w}x${h} format=${image.format} timestamp=$now")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "[OTG] Error processing acquired camera image", e)
                    } finally {
                        try {
                            image.close()
                        } catch (_: Exception) {}
                    }
                }, backgroundHandler)
            }

            cameraManager.openCamera(selectedCameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    Log.i(TAG, "[OTG] External camera device opened successfully: $selectedCameraId")
                    startCaptureSession(camera)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    Log.i(TAG, "[OTG] External camera hardware disconnected callback: $selectedCameraId")
                    camera.close()
                    cameraDevice = null
                    handleCameraDisconnected()
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "[OTG] External camera open error: $error on camera $selectedCameraId")
                    camera.close()
                    cameraDevice = null
                    isStreaming.set(false)
                    cameraStatus = "error"
                    emitStatusChanged(cameraStatus)
                }
            }, backgroundHandler)

            return true
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to open Camera2 hardware", e)
            return uvcDevice != null
        }
    }

    private fun startCaptureSession(camera: CameraDevice) {
        val readerSurface = imageReader?.surface ?: return
        try {
            val captureRequestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(readerSurface)
                set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
            }

            @Suppress("DEPRECATION")
            camera.createCaptureSession(listOf(readerSurface), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    try {
                        session.setRepeatingRequest(captureRequestBuilder.build(), null, backgroundHandler)
                        isStreaming.set(true)
                        cameraStatus = "streaming"
                        emitStatusChanged(cameraStatus)
                        Log.i(TAG, "[OTG] Live continuous camera stream active on external camera")
                    } catch (e: Exception) {
                        Log.e(TAG, "[OTG] Failed to start repeating capture request", e)
                        isStreaming.set(false)
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e(TAG, "[OTG] Camera capture session configuration failed")
                    isStreaming.set(false)
                    cameraStatus = "error"
                    emitStatusChanged(cameraStatus)
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to create capture session", e)
            isStreaming.set(false)
        }
    }

    private fun stopCameraCapture() {
        isStreaming.set(false)
        try {
            cameraHelper?.stopPreview()
            cameraHelper?.closeCamera()
        } catch (e: Exception) {
            Log.e(TAG, "[UVC] Error closing CameraHelper", e)
        }

        try {
            captureSession?.stopRepeating()
            captureSession?.close()
        } catch (_: Exception) {}
        captureSession = null

        try {
            cameraDevice?.close()
        } catch (_: Exception) {}
        cameraDevice = null

        try {
            imageReader?.close()
        } catch (_: Exception) {}
        imageReader = null

        latestFrameBase64 = null
        latestFrameTimestamp = 0L
        latestFrameSequence = 0L
        lastDeliveredSequence = 0L
        stopBackgroundThread()
    }

    @ReactMethod
    fun detectCamera(promise: Promise) {
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            if (!usbManager.hasPermission(uvcDevice)) {
                requestUsbPermission(uvcDevice)
                promise.resolve(null)
                return
            }
            handleCameraConnected(uvcDevice)
            promise.resolve(activeDeviceInfo)
            return
        }

        val externalId = findExternalCameraId()
        if (externalId != null) {
            val info = Arguments.createMap().apply {
                putString("id", "ext_cam_$externalId")
                putString("name", "External UVC Camera")
                putInt("vendorId", 0x0bda)
                putInt("productId", 0x58f4)
                putBoolean("isUvcCompatible", true)
                putString("resolution", "${DEFAULT_WIDTH}x${DEFAULT_HEIGHT} @ 30fps")
            }
            activeDeviceInfo = info
            cameraStatus = "connected"
            emitStatusChanged(cameraStatus)
            promise.resolve(info)
            return
        }

        activeDeviceInfo = null
        promise.resolve(null)
    }

    @ReactMethod
    fun connectCamera(promise: Promise) {
        Log.i(TAG, "[OTG] connectCamera() invoked")
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            if (!usbManager.hasPermission(uvcDevice)) {
                requestUsbPermission(uvcDevice)
                promise.resolve(false)
                return
            }
            handleCameraConnected(uvcDevice)
            try {
                cameraHelper?.selectDevice(uvcDevice)
            } catch (e: Exception) {
                Log.e(TAG, "[UVC] Error selecting device in connectCamera", e)
            }
            val opened = openCameraHardware()
            promise.resolve(opened)
            return
        }

        val externalId = findExternalCameraId()
        if (externalId != null) {
            val info = Arguments.createMap().apply {
                putString("id", "ext_cam_$externalId")
                putString("name", "External UVC Camera")
                putInt("vendorId", 0x0bda)
                putInt("productId", 0x58f4)
                putBoolean("isUvcCompatible", true)
                putString("resolution", "${DEFAULT_WIDTH}x${DEFAULT_HEIGHT} @ 30fps")
            }
            activeDeviceInfo = info
            cameraStatus = "connected"
            emitStatusChanged(cameraStatus)
            val opened = openCameraHardware()
            promise.resolve(opened)
            return
        }

        Log.w(TAG, "[OTG] connectCamera: No external USB/UVC camera found")
        cameraStatus = "disconnected"
        activeDeviceInfo = null
        emitStatusChanged(cameraStatus)
        promise.resolve(false)
    }

    @ReactMethod
    fun disconnectCamera(promise: Promise) {
        handleCameraDisconnected()
        promise.resolve(true)
    }

    @ReactMethod
    fun startStream(promise: Promise) {
        Log.i(TAG, "[OTG] startStream() invoked")
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            try {
                if (cameraHelper?.isCameraOpened == true) {
                    cameraHelper?.startPreview()
                    isStreaming.set(true)
                    cameraStatus = "streaming"
                    emitStatusChanged(cameraStatus)
                    promise.resolve(true)
                    return
                } else {
                    cameraHelper?.selectDevice(uvcDevice)
                    isStreaming.set(true)
                    cameraStatus = "streaming"
                    emitStatusChanged(cameraStatus)
                    promise.resolve(true)
                    return
                }
            } catch (e: Exception) {
                Log.e(TAG, "[UVC] Error starting preview in startStream", e)
            }
        }

        val opened = openCameraHardware()
        if (opened) {
            Log.i(TAG, "[OTG] startStream: Camera opened successfully")
            promise.resolve(true)
        } else {
            Log.w(TAG, "[OTG] startStream: Unable to open external camera hardware")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopStream(promise: Promise) {
        stopCameraCapture()
        cameraStatus = if (isConnectedUsbDevicePresent()) "connected" else "disconnected"
        emitStatusChanged(cameraStatus)
        promise.resolve(true)
    }

    @ReactMethod
    fun captureFrame(promise: Promise) {
        if (cameraStatus == "disconnected") {
            promise.resolve(null)
            return
        }
        val now = SystemClock.elapsedRealtime()
        val currentBase64 = latestFrameBase64
        val currentSeq = latestFrameSequence
        val currentTimestamp = latestFrameTimestamp

        // Latest frame mechanism: reject if no frame, if frame is older than 2500ms, or if not fresh
        if (currentBase64 == null || currentTimestamp == 0L || (now - currentTimestamp) > 2500L || currentSeq <= lastDeliveredSequence) {
            promise.resolve(null)
            return
        }

        lastDeliveredSequence = currentSeq
        val map = Arguments.createMap().apply {
            putString("data", currentBase64)
            putDouble("frameSequence", currentSeq.toDouble())
            putDouble("timestamp", currentTimestamp.toDouble())
            putInt("width", latestFrameWidth)
            putInt("height", latestFrameHeight)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(cameraStatus)
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        promise.resolve(activeDeviceInfo)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}

    override fun invalidate() {
        super.invalidate()
        if (activeInstance == this) {
            activeInstance = null
        }
        if (isReceiverRegistered) {
            try {
                reactContext.unregisterReceiver(usbReceiver)
                isReceiverRegistered = false
            } catch (_: Exception) {}
        }
        if (isAvailabilityCallbackRegistered) {
            try {
                cameraManager.unregisterAvailabilityCallback(cameraAvailabilityCallback)
                isAvailabilityCallbackRegistered = false
            } catch (_: Exception) {}
        }
        stopCameraCapture()
        try {
            cameraHelper?.release()
        } catch (_: Exception) {}
        cameraHelper = null
    }
}
