import express from 'express';
import { getLogger } from '@/utils/logger';
import { Stats } from '@/types';
import { vectorService } from '@/services/VectorService';

const router = express.Router();
const logger = getLogger('StatsRoute');

// 전체 시스템 통계 조회 엔드포인트
router.get('/', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const startTime = Date.now();

    // TODO: 실제 데이터 수집 구현
    const stats: Stats = {
      server: {
        uptime: Math.floor(process.uptime()),
        memory_usage: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        },
        cpu_usage: await getCPUUsage(),
      },
      documents: {
        total_documents: await getDocumentCount(),
        total_chunks: await getChunkCount(),
        storage_used: await getStorageUsed(), // MB
        processing_queue: await getProcessingQueueSize(),
      },
      requests: {
        total_requests: getRequestCount(),
        successful_requests: getSuccessfulRequestCount(),
        failed_requests: getFailedRequestCount(),
        average_response_time: getAverageResponseTime(),
      },
      ai_usage: {
        tokens_used: getTotalTokensUsed(),
        cost_estimated: getEstimatedCost(),
        models_used: getModelsUsageStats(),
      },
    };

    const responseTime = Date.now() - startTime;
    
    logger.info('Stats requested', { 
      responseTime: `${responseTime}ms`,
      requesterIP: req.ip,
    });

    res.success(stats);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get stats');
    res.error('Failed to retrieve system statistics', 'STATS_ERROR', 500);
  }
});

// 문서 관련 통계만 조회
router.get('/documents', async (req, res) => {
  try {
    const documentStats = {
      total_documents: await getDocumentCount(),
      total_chunks: await getChunkCount(),
      storage_used: await getStorageUsed(),
      processing_queue: await getProcessingQueueSize(),
      document_types: await getDocumentTypeBreakdown(),
      upload_history: await getUploadHistory(),
    };

    res.success(documentStats);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get document stats');
    res.error('Failed to retrieve document statistics', 'DOCUMENT_STATS_ERROR', 500);
  }
});

// AI 사용 통계만 조회
router.get('/ai-usage', async (req, res) => {
  try {
    const aiStats = {
      tokens_used: getTotalTokensUsed(),
      cost_estimated: getEstimatedCost(),
      models_used: getModelsUsageStats(),
      provider_breakdown: getProviderBreakdown(),
      usage_over_time: getUsageOverTime(),
    };

    res.success(aiStats);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get AI usage stats');
    res.error('Failed to retrieve AI usage statistics', 'AI_STATS_ERROR', 500);
  }
});

// 통계 수집 함수들 (TODO: 실제 구현)

async function getCPUUsage(): Promise<number> {
  // 임시 구현 - 실제로는 시스템 CPU 사용률 측정
  return Math.round(Math.random() * 50 + 10); // 10-60% 범위의 임시 값
}

async function getDocumentCount(): Promise<number> {
  try {
    if (!vectorService.isAvailable()) {
      return 0;
    }

    const stats = await vectorService.getStats();
    
    // 벡터 데이터베이스의 포인트 수를 기반으로 대략적인 문서 수 계산
    // 평균적으로 문서당 10개 청크가 있다고 가정
    const estimatedDocumentCount = Math.ceil(stats.total_vectors / 10);
    return estimatedDocumentCount;
  } catch (error) {
    logger.warn('Failed to get document count', error as Record<string, unknown>);
    return 0;
  }
}

async function getChunkCount(): Promise<number> {
  try {
    if (!vectorService.isAvailable()) {
      return 0;
    }

    const stats = await vectorService.getStats();
    return stats.total_vectors;
  } catch (error) {
    logger.warn('Failed to get chunk count', error as Record<string, unknown>);
    return 0;
  }
}

async function getStorageUsed(): Promise<number> {
  try {
    if (!vectorService.isAvailable()) {
      return 0;
    }

    const stats = await vectorService.getStats();
    
    // 벡터당 평균 크기를 계산하여 저장소 사용량 추정
    // 768차원 float32 벡터 + 메타데이터 = 대략 4KB per vector
    const estimatedSizeKB = stats.total_vectors * 4;
    const estimatedSizeMB = Math.round(estimatedSizeKB / 1024);
    
    return estimatedSizeMB;
  } catch (error) {
    logger.warn('Failed to get storage usage', error as Record<string, unknown>);
    return 0;
  }
}

async function getProcessingQueueSize(): Promise<number> {
  // TODO: 실제 처리 대기열 크기
  return 0; // 임시
}

// 간단한 통계 추적을 위한 글로벌 변수들 (실제로는 Redis나 Database 사용)
let requestCount = 0;
let successfulRequestCount = 0;
let failedRequestCount = 0;
let totalResponseTime = 0;
let totalTokensUsed = 0;
let estimatedCost = 0;
const modelsUsage: Record<string, number> = {};

function getRequestCount(): number {
  return requestCount;
}

function getSuccessfulRequestCount(): number {
  return successfulRequestCount;
}

function getFailedRequestCount(): number {
  return failedRequestCount;
}

function getAverageResponseTime(): number {
  return requestCount > 0 ? Math.round(totalResponseTime / requestCount) : 0;
}

function getTotalTokensUsed(): number {
  return totalTokensUsed;
}

function getEstimatedCost(): number {
  return Math.round(estimatedCost * 100) / 100; // 소수점 2자리
}

function getModelsUsageStats(): Record<string, number> {
  return { ...modelsUsage };
}

async function getDocumentTypeBreakdown() {
  // TODO: 문서 타입별 분석
  return {
    pdf: 0,
    txt: 0,
    docx: 0,
    xlsx: 0,
    csv: 0,
  };
}

async function getUploadHistory() {
  // TODO: 업로드 히스토리 (최근 7일)
  return [];
}

function getProviderBreakdown() {
  // TODO: AI 제공업체별 사용량
  return {
    google: 0,
    openai: 0,
    anthropic: 0,
    cohere: 0,
  };
}

function getUsageOverTime() {
  // TODO: 시간별 사용량 통계
  return [];
}

// 통계 업데이트 함수들 (다른 모듈에서 호출)
export function incrementRequestCount() {
  requestCount++;
}

export function incrementSuccessfulRequestCount() {
  successfulRequestCount++;
}

export function incrementFailedRequestCount() {
  failedRequestCount++;
}

export function addResponseTime(time: number) {
  totalResponseTime += time;
}

export function addTokenUsage(model: string, tokens: number, cost: number) {
  totalTokensUsed += tokens;
  estimatedCost += cost;
  
  if (modelsUsage[model]) {
    modelsUsage[model] += tokens;
  } else {
    modelsUsage[model] = tokens;
  }
}

export default router;