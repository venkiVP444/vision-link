package com.visionlinkmobile

import android.annotation.SuppressLint
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
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.util.Size
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class UsbCameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "UsbCamera"
        private const val DEFAULT_WIDTH = 640
        private const val DEFAULT_HEIGHT = 480
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

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    private val isStreaming = AtomicBoolean(false)
    private var isReceiverRegistered = false
    private var isAvailabilityCallbackRegistered = false

    private val cameraAvailabilityCallback = object : CameraManager.AvailabilityCallback() {
        override fun onCameraAvailable(cameraId: String) {
            super.onCameraAvailable(cameraId)
            Log.i(TAG, "[OTG] Camera available reported by CameraManager: $cameraId")
            try {
                val chars = cameraManager.getCameraCharacteristics(cameraId)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                    Log.i(TAG, "[OTG] External camera hardware ready: $cameraId")
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
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    if (device != null && isVideoDevice(device)) {
                        Log.i(TAG, "[OTG] UVC Camera connected: ${device.deviceName} (Vendor: ${device.vendorId}, Product: ${device.productId})")
                        handleCameraConnected(device)
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
        registerUsbReceiver()
        registerAvailabilityCallback()
        checkInitialUsbState()
    }

    private fun registerUsbReceiver() {
        if (isReceiverRegistered) return
        try {
            val filter = IntentFilter().apply {
                addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
                addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            }
            reactContext.registerReceiver(usbReceiver, filter)
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
            handleCameraConnected(uvcDevice)
        } else {
            cameraStatus = "disconnected"
        }
    }

    private fun handleCameraConnected(device: UsbDevice) {
        cameraStatus = "connected"
        activeDeviceInfo = Arguments.createMap().apply {
            putString("id", "usb_${device.vendorId}_${device.productId}")
            putString("name", device.productName ?: device.deviceName ?: "USB UVC Camera")
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

    /**
     * Converts an Android Image in YUV_420_888 format into an NV21 ByteArray.
     * Correctly handles rowStride, pixelStride, and cropRect across planar and semi-planar buffers.
     * Guarantees bounds safety against buffer capacity to prevent IndexOutOfBoundsException.
     */
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
                val vIndex = vRowStart + col * vPixelStride
                val uIndex = uRowStart + col * uPixelStride

                // NV21 requires V followed by U
                if (vIndex < vLimit) {
                    nv21[pos++] = vBuffer.get(vIndex)
                } else if (vLimit > 0) {
                    nv21[pos++] = vBuffer.get(vLimit - 1)
                } else {
                    nv21[pos++] = 0.toByte()
                }

                if (uIndex < uLimit) {
                    nv21[pos++] = uBuffer.get(uIndex)
                } else if (uLimit > 0) {
                    nv21[pos++] = uBuffer.get(uLimit - 1)
                } else {
                    nv21[pos++] = 0.toByte()
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

            // Fallback for devices mapping external USB camera as non-primary ID (not 0, not 1)
            for (id in cameraIds) {
                if (id != "0" && id != "1") {
                    Log.i(TAG, "[OTG] Found external camera by secondary ID: $id")
                    return id
                }
            }

            if (isConnectedUsbDevicePresent() && cameraIds.isNotEmpty()) {
                val fallbackId = cameraIds.last()
                Log.i(TAG, "[OTG] Fallback to last detected camera ID: $fallbackId")
                return fallbackId
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Error finding external camera ID", e)
        }
        return null
    }

    @SuppressLint("MissingPermission")
    private fun openCameraHardware(): Boolean {
        try {
            startBackgroundThread()

            val selectedCameraId = findExternalCameraId()
            if (selectedCameraId == null) {
                Log.w(TAG, "[OTG] No external camera ID found yet in CameraManager. Awaiting provider callback.")
                return false
            }

            val chars = cameraManager.getCameraCharacteristics(selectedCameraId)
            val configMap = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)

            val supportedFormats = configMap?.outputFormats ?: intArrayOf()
            Log.i(TAG, "[OTG] Camera $selectedCameraId supported formats: ${supportedFormats.joinToString()}")

            // Prioritize YUV_420_888 for preview streaming as standard for external camera providers
            val chosenFormat = if (supportedFormats.contains(ImageFormat.YUV_420_888)) {
                ImageFormat.YUV_420_888
            } else if (supportedFormats.contains(ImageFormat.JPEG)) {
                ImageFormat.JPEG
            } else {
                ImageFormat.YUV_420_888
            }

            val availableSizes = configMap?.getOutputSizes(chosenFormat) ?: emptyArray()
            Log.i(TAG, "[OTG] Output sizes for format $chosenFormat: ${availableSizes.joinToString { "${it.width}x${it.height}" }}")

            // Prioritize 320x240 (camera native hardware feed), then 640x480
            val chosenSize = availableSizes.firstOrNull { it.width == 320 && it.height == 240 }
                ?: availableSizes.firstOrNull { it.width == 640 && it.height == 480 }
                ?: availableSizes.minByOrNull { it.width * it.height }
                ?: Size(DEFAULT_WIDTH, DEFAULT_HEIGHT)

            val streamWidth = chosenSize.width
            val streamHeight = chosenSize.height
            Log.i(TAG, "[OTG] Configured preview reader: format=$chosenFormat, size=${streamWidth}x${streamHeight}")

            imageReader?.close()
            imageReader = ImageReader.newInstance(streamWidth, streamHeight, chosenFormat, 3).apply {
                setOnImageAvailableListener({ reader ->
                    val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                    try {
                        val w = image.width
                        val h = image.height
                        val now = SystemClock.elapsedRealtime()

                        val jpegBytes = if (image.format == ImageFormat.YUV_420_888) {
                            val nv21 = yuv420ToNv21(image)
                            val yuvImage = YuvImage(nv21, ImageFormat.NV21, w, h, null)
                            val out = ByteArrayOutputStream()
                            yuvImage.compressToJpeg(Rect(0, 0, w, h), 85, out)
                            out.toByteArray()
                        } else {
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            bytes
                        }

                        if (jpegBytes.isNotEmpty()) {
                            latestFrameSequence++
                            val currentSeq = latestFrameSequence
                            latestFrameTimestamp = now
                            latestFrameWidth = w
                            latestFrameHeight = h

                            val b64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
                            latestFrameBase64 = "data:image/jpeg;base64,$b64"

                            // Step 2 requirement log:
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
            Log.e(TAG, "[OTG] Failed to open camera hardware", e)
            return false
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

        promise.resolve(null)
    }

    @ReactMethod
    fun connectCamera(promise: Promise) {
        val uvcDevice = getConnectedVideoDevice()
        if (uvcDevice != null) {
            handleCameraConnected(uvcDevice)
            promise.resolve(true)
            return
        }
        cameraStatus = "connected"
        emitStatusChanged(cameraStatus)
        promise.resolve(true)
    }

    @ReactMethod
    fun disconnectCamera(promise: Promise) {
        handleCameraDisconnected()
        promise.resolve(true)
    }

    @ReactMethod
    fun startStream(promise: Promise) {
        val opened = openCameraHardware()
        if (opened) {
            promise.resolve(true)
        } else {
            // Camera not ready yet (waiting for HAL to register external ID)
            Log.i(TAG, "[OTG] startStream called: external camera opening or waiting for connection")
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

        // Latest frame mechanism: reject if no frame, if frame is older than 2s, or if no NEW frame has arrived
        if (currentBase64 == null || currentTimestamp == 0L || (now - currentTimestamp) > 2000L || currentSeq <= lastDeliveredSequence) {
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
    }
}
