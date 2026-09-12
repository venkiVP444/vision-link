/**
 * AI & Obstacle Detection Service
 * 
 * MVP Architecture Flow:
 * Camera Frame (Base64) -> AIService -> apiService (POST /api/detect) -> Roboflow Backend Model -> Detection Warning -> UI + TTS
 * 
 * Decoupled behind the IAIService abstraction.
 */

import { apiService } from '../../services/apiService';
import { DetectionResult, DetectedObject } from '../../types';

export interface IAIService {
  detectObjectsFromFrame(frameData?: string): Promise<DetectionResult>;
  getMockDetections(): DetectedObject[];
}

export class AIService implements IAIService {
  private mockObjects: DetectedObject[] = [
    {
      label: 'Person',
      confidence: 0.94,
      boundingBox: { x: 120, y: 80, width: 140, height: 280 },
      distance: 1.8,
      urgency: 'high',
    },
    {
      label: 'Chair',
      confidence: 0.88,
      boundingBox: { x: 40, y: 220, width: 90, height: 110 },
      distance: 1.2,
      urgency: 'medium',
    },
    {
      label: 'Door',
      confidence: 0.96,
      boundingBox: { x: 260, y: 50, width: 100, height: 320 },
      distance: 3.5,
      urgency: 'low',
    },
    {
      label: 'Stairs',
      confidence: 0.91,
      boundingBox: { x: 100, y: 300, width: 220, height: 90 },
      distance: 2.1,
      urgency: 'critical',
    },
    {
      label: 'Vehicle',
      confidence: 0.85,
      boundingBox: { x: 30, y: 60, width: 240, height: 180 },
      distance: 5.0,
      urgency: 'medium',
    },
  ];

  /**
   * Dispatches base64 camera frame to backend POST /api/detect.
   * Converts the response into the internal DetectionResult model:
   * - warning: string (active obstacle warning)
   * - warning: null (path clear, no warning)
   * - status: 'error' (API / processing failure)
   */
  async detectObjectsFromFrame(frameData?: string): Promise<DetectionResult> {
    if (!frameData) {
      return {
        status: 'error',
        warning: null,
        errorMessage: 'Invalid or missing image.',
        timestamp: Date.now(),
      };
    }

    const response = await apiService.detectImage(frameData);

    if (response.status === 'error') {
      return {
        status: 'error',
        warning: null,
        errorMessage: response.message,
        timestamp: Date.now(),
      };
    }

    return {
      status: 'success',
      warning: response.warning,
      timestamp: Date.now(),
    };
  }

  getMockDetections(): DetectedObject[] {
    return [...this.mockObjects];
  }
}

export const aiService = new AIService();
export default aiService;
