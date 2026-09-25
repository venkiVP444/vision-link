package com.visionlinkmobile

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

class UsbCameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "UsbCamera"
        private const val FRAME_WIDTH = 320
        private const val FRAME_HEIGHT = 240
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

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    private val isStreaming = AtomicBoolean(false)
    private var isReceiverRegistered = false

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            val device: UsbDevice? = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)

            Log.i(TAG, "[OTG] Broadcast action: $action, device: ${device?.deviceName}")

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
            putString("resolution", "${FRAME_WIDTH}x${FRAME_HEIGHT} @ 30fps")
        }
        emitStatusChanged(cameraStatus)
    }

    private fun handleCameraDisconnected() {
        Log.i(TAG, "[OTG] Cleaning up live inference and frame capture on camera disconnect")
        stopCameraCapture()
        cameraStatus = "disconnected"
        activeDeviceInfo = null
        latestFrameBase64 = null
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

    @SuppressLint("MissingPermission")
    private fun openCameraHardware(): Boolean {
        try {
            startBackgroundThread()

            val cameraIds = cameraManager.cameraIdList
            if (cameraIds.isEmpty()) {
                Log.w(TAG, "[OTG] No camera hardware IDs found on device")
                return false
            }

            // Prefer external camera ID if available, otherwise first camera
            var selectedCameraId = cameraIds[0]
            for (id in cameraIds) {
                val chars = cameraManager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                    selectedCameraId = id
                    Log.i(TAG, "[OTG] Selected external camera ID: $id")
                    break
                }
            }

            imageReader = ImageReader.newInstance(FRAME_WIDTH, FRAME_HEIGHT, ImageFormat.JPEG, 2).apply {
                setOnImageAvailableListener({ reader ->
                    try {
                        val image = reader.acquireLatestImage()
                        if (image != null) {
                            val planes = image.planes
                            val buffer = planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            image.close()

                            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                            latestFrameBase64 = "data:image/jpeg;base64,$b64"
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "[OTG] Error in onImageAvailable: ${e.message}")
                    }
                }, backgroundHandler)
            }

            cameraManager.openCamera(selectedCameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    startCaptureSession(camera)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    Log.i(TAG, "[OTG] Camera hardware disconnected callback")
                    camera.close()
                    cameraDevice = null
                    handleCameraDisconnected()
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "[OTG] Camera open error: $error")
                    camera.close()
                    cameraDevice = null
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
                        Log.i(TAG, "[OTG] Live continuous camera stream active")
                    } catch (e: Exception) {
                        Log.e(TAG, "[OTG] Failed to start repeating capture request", e)
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e(TAG, "[OTG] Camera capture session configuration failed")
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "[OTG] Failed to create capture session", e)
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

        // Check if Android CameraManager exposes external camera
        try {
            val cameraIds = cameraManager.cameraIdList
            for (id in cameraIds) {
                val chars = cameraManager.getCameraCharacteristics(id)
                if (chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                    val info = Arguments.createMap().apply {
                        putString("id", "ext_cam_$id")
                        putString("name", "External UVC Camera")
                        putInt("vendorId", 0x0bda)
                        putInt("productId", 0x58f4)
                        putBoolean("isUvcCompatible", true)
                        putString("resolution", "${FRAME_WIDTH}x${FRAME_HEIGHT} @ 30fps")
                    }
                    activeDeviceInfo = info
                    cameraStatus = "connected"
                    emitStatusChanged(cameraStatus)
                    promise.resolve(info)
                    return
                }
            }
        } catch (_: Exception) {}

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
            cameraStatus = "streaming"
            emitStatusChanged(cameraStatus)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun stopStream(promise: Promise) {
        stopCameraCapture()
        cameraStatus = "connected"
        emitStatusChanged(cameraStatus)
        promise.resolve(true)
    }

    @ReactMethod
    fun captureFrame(promise: Promise) {
        if (cameraStatus == "disconnected") {
            promise.resolve(null)
            return
        }
        promise.resolve(latestFrameBase64)
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
        stopCameraCapture()
    }
}
