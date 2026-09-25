/**
 * Vision-Link Environment Configuration
 * Centralized configuration. No secrets or cloud inference endpoints.
 * Note: AI object detection and neural TTS operate 100% offline on-device.
 */

export interface EnvironmentConfig {
  API_BASE_URL: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  TIMEOUT_MS: number;
}

export const Config: EnvironmentConfig = {
  API_BASE_URL: 'http://localhost:8080',
  ENVIRONMENT: 'development',
  TIMEOUT_MS: 15000,
};

export default Config;
