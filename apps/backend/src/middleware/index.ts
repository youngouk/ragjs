import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import { APIResponse } from '@/types';

const logger = getLogger('Middleware');

// CORS 미들웨어 설정
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // 개발 환경에서는 모든 오리진 허용 옵션
    if (process.env.DEVELOPMENT_CORS_ALL === 'true') {
      callback(null, true);
      return;
    }

    // 설정된 오리진만 허용
    if (!origin || config.server.cors_origins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS origin rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  optionsSuccessStatus: 200,
});

// 보안 미들웨어 설정
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// 압축 미들웨어
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // 1KB 이상만 압축
});

// Rate Limiting 미들웨어
export const rateLimitMiddleware = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    });
  },
});

// 요청 로깅 미들웨어 (통계 추적 포함)
export const requestLoggingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();

  // 헬스체크와 정적 파일은 로깅에서 제외
  const shouldSkip = req.originalUrl === '/health' || 
                     req.originalUrl === '/' || 
                     req.originalUrl.startsWith('/uploads/');

  if (!shouldSkip) {
    // 요청 카운트 증가 (stats.ts에서 import)
    try {
      const { incrementRequestCount } = require('@/routes/stats');
      incrementRequestCount();
    } catch (error) {
      // 통계 모듈 로드 실패 시 무시 (순환 참조 방지)
    }

    // 요청 로깅
    logger.logRequest(req, {
      body: req.method === 'GET' ? undefined : req.body,
      query: req.query,
    });
  }

  // 응답 완료 시 로깅 및 통계 업데이트
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    if (!shouldSkip) {
      logger.logResponse(req, res.statusCode, responseTime);

      // 통계 업데이트
      try {
        const { 
          incrementSuccessfulRequestCount, 
          incrementFailedRequestCount, 
          addResponseTime,
          addTokenUsage
        } = require('@/routes/stats');

        // 응답 시간 추가
        addResponseTime(responseTime);

        // 성공/실패 카운트
        if (res.statusCode >= 200 && res.statusCode < 400) {
          incrementSuccessfulRequestCount();
        } else {
          incrementFailedRequestCount();
        }

        // AI 관련 요청의 토큰 사용량 추적 (추정값)
        if (req.originalUrl.includes('/api/chat') || req.originalUrl.includes('/api/upload')) {
          const requestSize = JSON.stringify(req.body || {}).length;
          const estimatedTokens = Math.ceil(requestSize / 4);
          if (estimatedTokens > 0) {
            addTokenUsage('estimated', estimatedTokens, estimatedTokens * 0.0001);
          }
        }
      } catch (error) {
        // 통계 업데이트 실패 시 무시
      }
    }
  });

  next();
};

// 에러 처리 미들웨어
export const errorHandlerMiddleware = (
  error: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  logger.logError(error, 'Request Error', {
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers,
  });

  // Joi 검증 오류
  if (error.isJoi) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Express Validator 오류
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: validationErrors.array(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // CORS 오류
  if (error.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      code: 'CORS_ERROR',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Multer 파일 업로드 오류
  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE',
      details: {
        maxSize: config.upload.max_file_size,
        receivedSize: error.fileSize,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({
      success: false,
      error: 'Unexpected file field',
      code: 'INVALID_FILE_FIELD',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 기본 서버 오류
  const statusCode = error.status || error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: isProduction ? 'Internal server error' : error.message,
    code: error.code || 'INTERNAL_ERROR',
    ...(isProduction ? {} : { stack: error.stack }),
    timestamp: new Date().toISOString(),
  });
};

// 404 핸들러
export const notFoundMiddleware = (req: express.Request, res: express.Response) => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};

// 응답 헬퍼 미들웨어
export const responseHelperMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 성공 응답 헬퍼
  res.success = function<T>(data: T, message?: string) {
    const response: APIResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    
    if (message) {
      (response as any).message = message;
    }
    
    return this.json(response);
  };

  // 에러 응답 헬퍼
  res.error = function(message: string, code: string = 'ERROR', statusCode: number = 400, details?: any) {
    const response: APIResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
    
    if (details) {
      (response as any).details = details;
    }
    
    (response as any).code = code;
    
    return this.status(statusCode).json(response);
  };

  next();
};

// 타입 확장
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, message?: string): Response;
      error(message: string, code?: string, statusCode?: number, details?: any): Response;
    }
  }
}