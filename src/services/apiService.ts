/**
 * Vision-Link API Service
 * 
 * Handles network requests to the Vision-Link Backend.
 * Implements the finalized /api/detect contract for obstacle detection.
 */

import { Config } from '../config/environment';
import { ApiResponse, DetectImageRequest, DetectImageResponse } from '../types';

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = Config.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Sets or updates the base URL for API requests.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Gets the current configured base URL.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Dispatches a Base64 camera image to the obstacle detection endpoint.
   * Endpoint: POST /api/detect
   * Payload: { image: base64Image }
   */
  async detectImage(base64Image: string): Promise<DetectImageResponse> {
    if (!base64Image) {
      return {
        status: 'error',
        message: 'Invalid or missing image.',
      };
    }

    const endpointUrl = `${this.baseUrl}/api/detect`;
    const payload: DetectImageRequest = { image: base64Image };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Config.TIMEOUT_MS);

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let serverMessage = `HTTP Error ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && typeof errorData.message === 'string') {
            serverMessage = errorData.message;
          }
        } catch {
          // Response was not valid JSON
        }
        return {
          status: 'error',
          message: serverMessage,
        };
      }

      const jsonResponse: DetectImageResponse = await response.json();
      if (!jsonResponse || typeof jsonResponse.status !== 'string') {
        return {
          status: 'error',
          message: 'Unable to process image.',
        };
      }

      return jsonResponse;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Request timed out while connecting to server.'
            : error.message
          : 'Unable to process image.';

      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }

  /**
   * Generic GET request helper
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generic POST request helper
   */
  async post<T, B = unknown>(endpoint: string, body: B): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
        timestamp: Date.now(),
      };
    }
  }
}

export const apiService = new ApiService();
export default apiService;
