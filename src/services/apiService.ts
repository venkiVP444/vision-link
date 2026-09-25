/**
 * Vision-Link API Service
 *
 * Generic HTTP client helper for Vision-Link services.
 * NOTE: Object detection is 100% offline via on-device TFLite (no /api/detect).
 */

import { Config } from '../config/environment';
import { ApiResponse } from '../types';

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = Config.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
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
