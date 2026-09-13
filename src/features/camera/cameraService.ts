/**
 * Camera Service Abstraction
 * 
 * IMPORTANT ARCHITECTURAL BOUNDARY:
 * Actual Android USB Host / UVC camera integration will be implemented
 * once the physical camera hardware is connected via USB OTG.
 * 
 * Future Android Native bridge requirements:
 * 1. Android UsbManager & UsbDevice enumeration
 * 2. UsbAccessory / USB Host permission handling via PendingIntent
 * 3. UVC video frame extraction using native libuvc / MediaCodec
 * 4. Frame delivery to React Native via JNI bridge
 * 
 * This service implements the complete client-facing camera lifecycle
 * and provides realistic mock states for UI development and testing.
 */

import { CameraDeviceInfo, CameraStatus } from '../../types';
import { SAMPLE_PERSON_FRAME } from './mockFrame';

export type CameraStatusListener = (status: CameraStatus) => void;

export interface ICameraService {
  detectCamera(): Promise<CameraDeviceInfo | null>;
  connectCamera(deviceId?: string): Promise<boolean>;
  disconnectCamera(): Promise<void>;
  startStream(): Promise<boolean>;
  stopStream(): Promise<void>;
  captureFrame(): Promise<string | null>; // Returns base64 or URI when hardware is integrated
  getStatus(): CameraStatus;
  getDeviceInfo(): CameraDeviceInfo | null;
  onStatusChange(listener: CameraStatusListener): () => void;
}

export class CameraService implements ICameraService {
  private status: CameraStatus = 'disconnected';
  private deviceInfo: CameraDeviceInfo | null = null;
  private listeners: Set<CameraStatusListener> = new Set();

  private setStatus(newStatus: CameraStatus) {
    this.status = newStatus;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch {
        // Suppress listener errors in callback
      }
    });
  }

  onStatusChange(listener: CameraStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async detectCamera(): Promise<CameraDeviceInfo | null> {
    // Realistic mock device info simulating external UVC camera connected via USB OTG
    this.deviceInfo = {
      id: 'uvc-otg-vl1',
      name: 'Vision-Link External UVC Wide-Angle Cam',
      vendorId: 0x0bda,
      productId: 0x58f4,
      isUvcCompatible: true,
      resolution: '1920x1080 @ 30fps',
    };
    return this.deviceInfo;
  }

  async connectCamera(_deviceId?: string): Promise<boolean> {
    this.setStatus('connecting');
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 300));
    
    if (!this.deviceInfo) {
      await this.detectCamera();
    }
    
    this.setStatus('connected');
    return true;
  }

  async disconnectCamera(): Promise<void> {
    this.setStatus('disconnected');
  }

  async startStream(): Promise<boolean> {
    if (this.status !== 'connected') {
      const connected = await this.connectCamera();
      if (!connected) {
        return false;
      }
    }
    this.setStatus('streaming');
    return true;
  }

  async stopStream(): Promise<void> {
    if (this.status === 'streaming') {
      this.setStatus('connected');
    }
  }

  async captureFrame(): Promise<string | null> {
    if (this.status !== 'streaming' && this.status !== 'connected') {
      return null;
    }
    // Architectural Integration Point:
    // When external USB OTG UVC camera is physically attached, native libuvc /
    // MediaCodec JNI bridge will supply real-time captured video frames here.
    // In simulator/mock mode, returns a realistic test Base64 JPEG frame containing a person
    // to verify the end-to-end live Roboflow AI detection pipeline.
    return SAMPLE_PERSON_FRAME;
  }

  getStatus(): CameraStatus {
    return this.status;
  }

  getDeviceInfo(): CameraDeviceInfo | null {
    return this.deviceInfo;
  }
}

export const cameraService = new CameraService();
export default cameraService;
