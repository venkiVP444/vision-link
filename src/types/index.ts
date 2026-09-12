/**
 * Vision-Link Mobile Type Definitions
 * Reusable strongly-typed domain interfaces for camera, AI, navigation, SOS, and services.
 */

// Backend Obstacle Detection API Contract
export interface DetectImageRequest {
  image: string; // Base64 image string
}

export interface DetectImageSuccessResponse {
  status: 'success';
  warning: string | null;
}

export interface DetectImageErrorResponse {
  status: 'error';
  message: string;
}

export type DetectImageResponse = DetectImageSuccessResponse | DetectImageErrorResponse;

export interface DetectionResult {
  status: 'success' | 'error';
  warning: string | null;
  errorMessage?: string;
  timestamp: number;
}

// Bounding Box & Legacy Detection Types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
  distance?: number; // Estimated distance in meters
  urgency?: UrgencyLevel;
}

export type CameraStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error';

export interface CameraDeviceInfo {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  isUvcCompatible: boolean;
  resolution?: string;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
}

export type MovementDirection =
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'u-turn'
  | 'arrive';

export interface NavigationInstruction {
  id: string;
  instruction: string;
  distanceMeters?: number;
  direction?: MovementDirection;
}

export type NavigationStatus = 'idle' | 'navigating' | 'paused' | 'arrived';

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relation?: string;
}

export type SOSStatus =
  | 'idle'
  | 'confirming'
  | 'triggered'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';

export interface SOSPayload {
  timestamp: number;
  location?: LocationCoordinates;
  contacts: EmergencyContact[];
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface TTSPreferences {
  speechRate: number; // 0.5 to 2.0
  pitch: number;      // 0.5 to 2.0
  autoAnnounceDetections: boolean;
}

export interface DetectionPreferences {
  confidenceThreshold: number; // 0.0 to 1.0 (e.g., 0.6)
  announceDistance: boolean;
  alertProximityMeters: number; // e.g. 2.0
}

export interface AppSettings {
  highContrast: boolean;
  hapticFeedback: boolean;
  cameraAutoConnect: boolean;
  tts: TTSPreferences;
  detection: DetectionPreferences;
}
