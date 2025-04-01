import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads configuration from .env file and .aicodereviewrc file
 * @returns {Object} - Merged configuration object
 */
export function loadConfig() {
  // Initialize with empty config
  let config = {};

  // Try to load .env file from current directory
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      config = { ...config, ...envConfig };
    }
  } catch (error) {
    console.warn(`Warning: Could not load .env file: ${error.message}`);
  }

  // Try to load .aicodereviewrc file from current directory
  try {
    const rcPath = path.resolve(process.cwd(), '.aicodereviewrc');
    if (fs.existsSync(rcPath)) {
      const rcConfig = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      config = { ...config, ...rcConfig };
    }
  } catch (error) {
    console.warn(`Warning: Could not load .aicodereviewrc file: ${error.message}`);
  }

  // Add environment variables
  config = { ...config, ...process.env };

  // Map legacy environment variables to new names for backward compatibility
  if (config.NEXT_PUBLIC_DEEPSEEK_API_KEY && !config.DEEPSEEK_API_KEY) {
    config.DEEPSEEK_API_KEY = config.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  }

  return config;
}

/**
 * Validates that all required configuration values are present
 * @param {Object} config - Configuration object
 * @param {string[]} requiredKeys - List of required keys
 * @returns {string[]} - List of missing keys
 */
export function validateConfig(config, requiredKeys) {
  const missingKeys = [];
  
  for (const key of requiredKeys) {
    if (!config[key]) {
      missingKeys.push(key);
    }
  }
  
  return missingKeys;
}
