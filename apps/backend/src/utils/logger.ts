import winston from 'winston';
import { config } from '@/config';

// 로그 레벨 정의
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// 로그 색상 정의
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'grey',
  debug: 'white',
  silly: 'grey',
};

winston.addColors(logColors);

// 개발 환경용 포맷
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.metadata ? ` ${JSON.stringify(info.metadata)}` : ''
    }`
  )
);

// 프로덕션 환경용 포맷
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// 트랜스포터 설정
const getTransports = () => {
  const transports: winston.transport[] = [
    // 콘솔 출력
    new winston.transports.Console({
      level: config.logging.level,
      format: config.logging.format === 'json' ? productionFormat : developmentFormat,
    }),
  ];

  // 프로덕션에서는 파일 로그도 추가
  if (!config.server.host.includes('localhost')) {
    transports.push(
      // 에러 로그 파일
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // 전체 로그 파일
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    );
  }

  return transports;
};

// Winston 로거 생성
const logger = winston.createLogger({
  levels: logLevels,
  level: config.logging.level,
  transports: getTransports(),
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// 로그 메타데이터 확장을 위한 클래스
export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(message: string, metadata?: Record<string, unknown>) {
    const baseMetadata = {
      context: this.context,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    return {
      message,
      ...baseMetadata,
    };
  }

  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>) {
    const logData = this.formatMessage(message, { ...metadata, error });
    logger.error(logData);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    const logData = this.formatMessage(message, metadata);
    logger.warn(logData);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    const logData = this.formatMessage(message, metadata);
    logger.info(logData);
  }

  http(message: string, metadata?: Record<string, unknown>) {
    const logData = this.formatMessage(message, metadata);
    logger.http(logData);
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    const logData = this.formatMessage(message, metadata);
    logger.debug(logData);
  }

  // 요청 로깅용 헬퍼
  logRequest(req: { method: string; url: string; headers: Record<string, unknown> }, metadata?: Record<string, unknown>) {
    this.http(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'],
      ...metadata,
    });
  }

  // 응답 로깅용 헬퍼
  logResponse(req: { method: string; url: string }, statusCode: number, responseTime: number, metadata?: Record<string, unknown>) {
    this.http(`${req.method} ${req.url} ${statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ...metadata,
    });
  }

  // AI 서비스 로깅용 헬퍼
  logAIUsage(provider: string, model: string, tokensUsed: number, cost: number, metadata?: Record<string, unknown>) {
    this.info(`AI service used: ${provider}`, {
      provider,
      model,
      tokensUsed,
      estimatedCost: cost,
      ...metadata,
    });
  }

  // 에러 추적용 헬퍼
  logError(error: Error, context?: string, metadata?: Record<string, unknown>) {
    this.error(`${context || 'Unhandled error'}: ${error.message}`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...metadata,
    });
  }
}

// 기본 로거 팩토리 함수
export const getLogger = (context: string): Logger => {
  return new Logger(context);
};

// 기본 Winston 로거도 export (필요한 경우)
export { logger as winstonLogger };

// 글로벌 에러 핸들러 설정
process.on('uncaughtException', (error: Error) => {
  const globalLogger = getLogger('Global');
  globalLogger.logError(error, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const globalLogger = getLogger('Global');
  globalLogger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
});

export default logger;