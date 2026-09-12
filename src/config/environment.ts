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
  // Configured for local development backend API
  API_BASE_URL: 'http://10.0.2.2:5000',
  ENVIRONMENT: 'development',
  TIMEOUT_MS: 15000,
};

export default Config;
