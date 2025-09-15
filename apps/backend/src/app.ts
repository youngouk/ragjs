require('module-alias/register');
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import {
  corsMiddleware,
  securityMiddleware,
  compressionMiddleware,
  rateLimitMiddleware,
  requestLoggingMiddleware,
  responseHelperMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
} from '@/middleware';

// 라우터 import
import healthRouter from '@/routes/health';
import uploadRouter from '@/routes/upload';
import chatRouter from '@/routes/chat';
import statsRouter from '@/routes/stats';

const logger = getLogger('App');

class SimpleRAGServer {
  private app: express.Application;
  private server: any;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    logger.info('Setting up middleware...');

    // 기본 미들웨어
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // 보안 미들웨어
    this.app.use(securityMiddleware);
    this.app.use(corsMiddleware);
    
    // 성능 미들웨어
    this.app.use(compressionMiddleware);
    this.app.use(rateLimitMiddleware);
    
    // 커스텀 미들웨어
    this.app.use(requestLoggingMiddleware);
    this.app.use(responseHelperMiddleware);

    // 정적 파일 서빙
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    logger.info('Middleware setup completed');
  }

  private setupRoutes(): void {
    logger.info('Setting up routes...');

    // 기본 헬스체크
    this.app.get('/', (req, res) => {
      res.success({
        name: 'Simple RAG Node.js Backend',
        version: '1.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        features: [
          'Document Upload & Processing',
          'Vector Search & Retrieval',
          'Multi-LLM Generation',
          'Session Management',
          'Real-time Chat Interface',
        ],
        endpoints: {
          health: '/health',
          upload: '/api/upload',
          chat: '/api/chat',
          stats: '/stats',
        },
      }, 'Simple RAG API is running successfully');
    });

    // API 라우터 연결
    this.app.use('/health', healthRouter);
    this.app.use('/api/upload', uploadRouter);
    this.app.use('/api/chat', chatRouter);
    this.app.use('/stats', statsRouter);

    // API 정보 엔드포인트
    this.app.get('/info', (req, res) => {
      res.success({
        name: 'Simple RAG API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        description: 'Node.js backend for Simple RAG Chatbot system, migrated from Python FastAPI',
        features: [
          'Document Upload & Processing (PDF, TXT, DOCX, XLSX, CSV)',
          'Vector Search with Hybrid Retrieval',
          'Multi-LLM Generation (Google Gemini, OpenAI, Anthropic, Cohere)',
          'Session Management with TTL',
          'Real-time Chat Interface',
          'Admin Statistics Dashboard',
          'Rate Limiting & Security',
          'Structured Logging',
        ],
        ai_providers_configured: this.getConfiguredAIProviders(),
        api_endpoints: {
          health: {
            path: '/health',
            methods: ['GET'],
            description: 'System health check and service status',
          },
          info: {
            path: '/info',
            methods: ['GET'],
            description: 'API information and capabilities',
          },
          upload: {
            path: '/api/upload',
            methods: ['POST'],
            description: 'Upload documents for processing',
          },
          upload_status: {
            path: '/api/upload/status/:jobId',
            methods: ['GET'],
            description: 'Check document processing status',
          },
          documents: {
            path: '/api/upload/documents',
            methods: ['GET'],
            description: 'List uploaded documents with pagination',
          },
          document_delete: {
            path: '/api/upload/documents/:id',
            methods: ['DELETE'],
            description: 'Delete a specific document',
          },
          bulk_delete: {
            path: '/api/upload/documents/bulk-delete',
            methods: ['POST'],
            description: 'Delete multiple documents at once',
          },
          chat: {
            path: '/api/chat',
            methods: ['POST'],
            description: 'Send chat message and get AI response',
          },
          chat_history: {
            path: '/api/chat/history/:sessionId',
            methods: ['GET'],
            description: 'Get chat history for a session',
          },
          new_session: {
            path: '/api/chat/session',
            methods: ['POST'],
            description: 'Start a new chat session',
          },
          stats: {
            path: '/stats',
            methods: ['GET'],
            description: 'Get system statistics and usage metrics',
          },
        },
        migration_info: {
          original_system: 'Python FastAPI',
          migration_date: '2025-09-14',
          compatibility: 'Fully compatible with existing frontend',
          improvements: [
            'Better TypeScript integration',
            'Enhanced error handling',
            'Improved logging system',
            'Graceful shutdown handling',
            'Better resource management',
          ],
        },
      });
    });

    logger.info('Routes setup completed');
  }

  private setupErrorHandling(): void {
    logger.info('Setting up error handling...');

    // 404 핸들러 (모든 라우트 이후)
    this.app.use(notFoundMiddleware);

    // 전역 에러 핸들러 (가장 마지막)
    this.app.use(errorHandlerMiddleware);

    logger.info('Error handling setup completed');
  }

  private getConfiguredAIProviders(): string[] {
    const providers: string[] = [];
    
    if (config.ai.google.api_key) providers.push('Google Gemini');
    if (config.ai.openai.api_key) providers.push('OpenAI GPT');
    if (config.ai.anthropic.api_key) providers.push('Anthropic Claude');
    if (config.ai.cohere.api_key) providers.push('Cohere Command');
    
    return providers;
  }

  public async start(): Promise<void> {
    try {
      // 서버 시작 전 필수 검증
      await this.validateEnvironment();

      // HTTP 서버 생성
      this.server = createServer(this.app);

      // Graceful shutdown 처리
      this.setupGracefulShutdown();

      // 서버 시작
      await new Promise<void>((resolve, reject) => {
        this.server.listen(config.server.port, config.server.host, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      logger.info(`🚀 Simple RAG Server started successfully`, {
        port: config.server.port,
        host: config.server.host,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid,
        aiProviders: this.getConfiguredAIProviders(),
        corsOrigins: config.server.cors_origins,
      });

      // 시작 완료 후 시스템 정보 로깅
      this.logSystemInfo();

      // 웰컴 메시지
      this.displayWelcomeMessage();

    } catch (error) {
      logger.logError(error as Error, 'Failed to start server');
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    logger.info('Validating environment...');

    const checks: Array<{ name: string; check: () => boolean | Promise<boolean> }> = [
      {
        name: 'Configuration',
        check: () => !!config,
      },
      {
        name: 'AI Services',
        check: () => this.getConfiguredAIProviders().length > 0,
      },
      {
        name: 'Upload directory',
        check: async () => {
          try {
            const fs = await import('fs/promises');
            await fs.access(config.upload.upload_dir);
            return true;
          } catch {
            try {
              const fs = await import('fs/promises');
              await fs.mkdir(config.upload.upload_dir, { recursive: true });
              logger.info('Upload directory created', { path: config.upload.upload_dir });
              return true;
            } catch {
              return false;
            }
          }
        },
      },
      {
        name: 'Logs directory',
        check: async () => {
          try {
            const fs = await import('fs/promises');
            await fs.access('./logs');
            return true;
          } catch {
            try {
              const fs = await import('fs/promises');
              await fs.mkdir('./logs', { recursive: true });
              logger.info('Logs directory created');
              return true;
            } catch {
              return false;
            }
          }
        },
      },
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        if (!result) {
          throw new Error(`${name} validation failed`);
        }
        logger.info(`✅ ${name} validation passed`);
      } catch (error) {
        logger.error(`❌ ${name} validation failed`, error as Error);
        throw error;
      }
    }

    logger.info('Environment validation completed');
  }

  private logSystemInfo(): void {
    const memoryUsage = process.memoryUsage();
    
    logger.info('System Information', {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      uptime: `${Math.floor(process.uptime())}s`,
      configured_providers: this.getConfiguredAIProviders(),
    });
  }

  private displayWelcomeMessage(): void {
    console.log('\n🎉 Simple RAG Node.js Backend Successfully Started!\n');
    console.log(`📡 Server: http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}`);
    console.log(`🔍 Health Check: http://localhost:${config.server.port}/health`);
    console.log(`📊 API Info: http://localhost:${config.server.port}/info`);
    console.log(`📈 Stats: http://localhost:${config.server.port}/stats`);
    console.log('\n💡 Key Features:');
    console.log('   • Document Upload & Processing');
    console.log('   • Vector Search & Retrieval');
    console.log('   • Multi-LLM Generation');
    console.log('   • Session Management');
    console.log('   • Real-time Chat');
    
    if (this.getConfiguredAIProviders().length > 0) {
      console.log(`\n🤖 AI Providers Configured: ${this.getConfiguredAIProviders().join(', ')}`);
    } else {
      console.log('\n⚠️  Warning: No AI providers configured. Please set API keys in environment variables.');
    }
    
    console.log('\n🔗 Python FastAPI Migration Complete - Fully Compatible!\n');
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit...');
        process.exit(1);
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // 서버 종료
      if (this.server) {
        this.server.close((error: Error) => {
          if (error) {
            logger.logError(error, 'Error during server shutdown');
            process.exit(1);
          } else {
            logger.info('Server closed successfully');
            process.exit(0);
          }
        });

        // 강제 종료 타이머 (30초)
        setTimeout(() => {
          logger.warn('Forceful shutdown after timeout');
          process.exit(1);
        }, 30000);
      } else {
        process.exit(0);
      }
    };

    // 신호 핸들러 등록
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 예상치 못한 종료 처리
    process.on('exit', (code) => {
      logger.info(`Process exiting with code: ${code}`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// 서버 인스턴스 생성 및 시작
const server = new SimpleRAGServer();

// 메인 모듈인지 확인 (CommonJS)
if (require.main === module) {
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default server;
export { SimpleRAGServer };