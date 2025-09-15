import express from 'express';
import { getLogger } from '@/utils/logger';
import { HealthStatus } from '@/types';
import { embeddingService } from '@/services/EmbeddingService';
import { generationService } from '@/services/GenerationService';
import { vectorService } from '@/services/VectorService';

const router = express.Router();
const logger = getLogger('HealthRoute');

// 헬스체크 엔드포인트
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 시스템 상태 체크
    const memoryUsage = process.memoryUsage();
    const uptime = Math.floor(process.uptime());
    
    // AI 서비스 상태 체크 (TODO: 실제 구현 필요)
    const aiServiceStatus = await checkAIServices();
    
    // 벡터 DB 상태 체크 (TODO: 실제 구현 필요)
    const vectorDbStatus = await checkVectorDatabase();
    
    // 세션 관리자 상태 체크 (TODO: 실제 구현 필요)
    const sessionStatus = await checkSessionManager();
    
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        llm: aiServiceStatus,
        vector: vectorDbStatus,
        session: sessionStatus,
      },
    };

    const responseTime = Date.now() - startTime;
    
    logger.info('Health check completed', {
      status: healthStatus.status,
      responseTime: `${responseTime}ms`,
      services: healthStatus.services,
    });

    res.success(healthStatus);

  } catch (error) {
    logger.logError(error as Error, 'Health check failed');
    
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'HEALTH_CHECK_FAILED',
      timestamp: new Date().toISOString(),
      services: {
        llm: false,
        vector: false,
        session: false,
      },
    });
  }
});

// 상세 시스템 정보 엔드포인트
router.get('/info', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    
    const systemInfo = {
      name: 'Simple RAG API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      server: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      features: [
        'Document Upload & Processing',
        'Vector Search & Retrieval',
        'Multi-LLM Generation',
        'Session Management',
        'Real-time Chat Interface',
        'Admin Dashboard',
      ],
    };

    logger.info('System info requested', {
      requesterIP: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.success(systemInfo);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get system info');
    res.error('Failed to retrieve system information', 'SYSTEM_INFO_ERROR', 500);
  }
});

// 서비스별 상태 체크 함수들
async function checkAIServices(): Promise<boolean> {
  try {
    // 임베딩 서비스 상태 확인
    const embeddingAvailable = embeddingService.isAvailable();
    
    // 생성 서비스 상태 확인
    const availableProviders = generationService.getAvailableProviders();
    const generationAvailable = availableProviders.length > 0;

    // 실제 AI 서비스 헬스체크 (간단한 테스트)
    let healthCheckPassed = false;
    if (embeddingAvailable && generationAvailable) {
      try {
        // 임베딩 서비스 헬스체크
        await embeddingService.healthCheck();
        
        // 생성 서비스 헬스체크 (첫 번째 사용 가능한 프로바이더만)
        const healthStatus = await generationService.healthCheck();
        const anyProviderHealthy = Object.values(healthStatus).some(status => status === true);
        
        healthCheckPassed = anyProviderHealthy;
      } catch (healthError) {
        logger.warn('AI services health check test failed', healthError as Record<string, unknown>);
        healthCheckPassed = false;
      }
    }

    logger.info('AI services health check completed', {
      embeddingAvailable,
      generationAvailable,
      availableProviders,
      healthCheckPassed,
    });

    return embeddingAvailable && generationAvailable && healthCheckPassed;
    
  } catch (error) {
    logger.warn('AI services health check failed', error as Record<string, unknown>);
    return false;
  }
}

async function checkVectorDatabase(): Promise<boolean> {
  try {
    // Qdrant 벡터 서비스 상태 확인
    const vectorAvailable = vectorService.isAvailable();
    
    if (!vectorAvailable) {
      logger.warn('Vector service not available');
      return false;
    }

    // 실제 연결 상태 확인
    const healthCheckPassed = await vectorService.healthCheck();
    
    logger.info('Vector database health check completed', {
      vectorAvailable,
      healthCheckPassed,
    });

    return healthCheckPassed;
    
  } catch (error) {
    logger.warn('Vector database health check failed', error as Record<string, unknown>);
    return false;
  }
}

async function checkSessionManager(): Promise<boolean> {
  try {
    // TODO: 세션 매니저 상태 체크 구현
    // - Redis 연결 상태 (사용하는 경우)
    // - 메모리 세션 상태
    // - 세션 정리 프로세스 상태
    
    return true; // 임시로 true 반환
  } catch (error) {
    logger.warn('Session manager health check failed', error as Record<string, unknown>);
    return false;
  }
}

export default router;