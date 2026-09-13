/**
 * Vision-Link Environment Configuration
 * Centralized configuration placeholder. No secrets or production endpoints hardcoded.
 */

export interface EnvironmentConfig {
  API_BASE_URL: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  TIMEOUT_MS: number;
}

export const Config: EnvironmentConfig = {
  // Configured with live ngrok backend API
  API_BASE_URL: 'https://art-earring-bright.ngrok-free.dev',
  ENVIRONMENT: 'development',
  TIMEOUT_MS: 30000,
};

export default Config;
