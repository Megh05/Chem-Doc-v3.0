import fs from 'fs';
import path from 'path';

export interface AppConfig {
  apiSettings: {
    mistralApiKey: string;
    ocrEndpoint: string;
    llmModel: string;
  };
  processingSettings: {
    autoProcessing: boolean;
    accuracyThreshold: number;
    maxFileSize: number;
    retryAttempts: number;
  };
  notificationSettings: {
    emailNotifications: boolean;
    processingComplete: boolean;
    processingFailed: boolean;
    weeklyReports: boolean;
  };
  featureFlags: {
    msdsParserV2: boolean;
  };
}

const defaultConfig: AppConfig = {
  apiSettings: {
    mistralApiKey: "",
    ocrEndpoint: "https://api.mistral.ai/v1/ocr",
    llmModel: "mistral-large-latest"
  },
  processingSettings: {
    autoProcessing: true,
    accuracyThreshold: 95,
    maxFileSize: 50,
    retryAttempts: 3
  },
  notificationSettings: {
    emailNotifications: true,
    processingComplete: true,
    processingFailed: true,
    weeklyReports: false
  },
  featureFlags: {
    msdsParserV2: process.env.MSDS_PARSER_V2 === '1'
  }
};

const configPath = path.join(process.cwd(), 'config.json');

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      // Merge deeply to preserve nested structure
      return {
        ...defaultConfig,
        ...config,
        apiSettings: { ...defaultConfig.apiSettings, ...config.apiSettings },
        processingSettings: { ...defaultConfig.processingSettings, ...config.processingSettings },
        notificationSettings: { ...defaultConfig.notificationSettings, ...config.notificationSettings },
        featureFlags: { ...defaultConfig.featureFlags, ...config.featureFlags }
      };
    }
  } catch (error) {
    console.warn('Failed to load config file, using defaults:', error);
  }
  return defaultConfig;
}

export function saveConfig(config: AppConfig): void {
  try {
    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, configData, 'utf-8');
    console.log('Configuration saved successfully to', configPath);
  } catch (error) {
    console.error('Failed to save config file:', error);
    throw new Error('Failed to save configuration');
  }
}

export function resetConfig(): AppConfig {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return defaultConfig;
  } catch (error) {
    console.error('Failed to reset config file:', error);
    throw new Error('Failed to reset configuration');
  }
}

/**
 * Feature flag helper for MSDS Parser V2
 * Returns true if MSDS_PARSER_V2 environment variable is set to '1'
 */
export const isParserV2 = (): boolean => process.env.MSDS_PARSER_V2 === '1';