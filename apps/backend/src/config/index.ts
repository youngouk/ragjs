import { config as dotenvConfig } from 'dotenv';
import { AppConfig } from '@/types';

// 환경변수 로드
dotenvConfig();

class ConfigManager {
  private static instance: ConfigManager;
  private _config: AppConfig;

  private constructor() {
    this._config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    return {
      server: {
        port: parseInt(process.env.PORT || '8000'),
        host: process.env.HOST || '0.0.0.0',
        cors_origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
      },
      ai: {
        google: {
          api_key: process.env.GOOGLE_AI_API_KEY || '',
          model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-pro',
        },
        openai: {
          api_key: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-4o',
        },
        anthropic: {
          api_key: process.env.ANTHROPIC_API_KEY || '',
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        },
        cohere: {
          api_key: process.env.COHERE_API_KEY || '',
          model: process.env.COHERE_MODEL || 'command-r-plus',
        },
      },
      vector_db: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        ...(process.env.QDRANT_API_KEY && { api_key: process.env.QDRANT_API_KEY }),
        collection_name: process.env.QDRANT_COLLECTION_NAME || 'simple_rag_docs',
      },
      upload: {
        max_file_size: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
        allowed_types: (process.env.ALLOWED_FILE_TYPES || 'pdf,txt,docx,xlsx,csv').split(','),
        upload_dir: process.env.UPLOAD_DIR || './uploads',
      },
      session: {
        ttl: parseInt(process.env.SESSION_TTL || '3600'), // 1 hour
        cleanup_interval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '300'), // 5 minutes
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
      },
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // 필수 AI API 키 검증 (최소 하나는 있어야 함)
    const aiKeys = [
      this._config.ai.google.api_key,
      this._config.ai.openai.api_key,
      this._config.ai.anthropic.api_key,
      this._config.ai.cohere.api_key,
    ];

    if (aiKeys.every(key => !key)) {
      errors.push('At least one AI service API key must be provided');
    }

    // 포트 검증
    if (this._config.server.port < 1 || this._config.server.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // 파일 크기 검증
    if (this._config.upload.max_file_size < 1024) {
      errors.push('Max file size must be at least 1KB');
    }

    // TTL 검증
    if (this._config.session.ttl < 60) {
      errors.push('Session TTL must be at least 60 seconds');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  public get config(): AppConfig {
    return this._config;
  }

  public isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public getAIServiceKeys(): string[] {
    const keys: string[] = [];
    if (this._config.ai.google.api_key) keys.push('google');
    if (this._config.ai.openai.api_key) keys.push('openai');
    if (this._config.ai.anthropic.api_key) keys.push('anthropic');
    if (this._config.ai.cohere.api_key) keys.push('cohere');
    return keys;
  }
}

// 싱글톤 인스턴스 생성 및 export
export const configManager = ConfigManager.getInstance();
export const config = configManager.config;