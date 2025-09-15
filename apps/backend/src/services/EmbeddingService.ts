import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('EmbeddingService');

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens_used: number;
}

export interface EmbeddingBatch {
  embeddings: EmbeddingResult[];
  total_tokens: number;
  processing_time: number;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private genAI: GoogleGenerativeAI | null = null;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      if (!config.ai.google.api_key) {
        logger.warn('Google API key not provided, embedding service will be unavailable');
        return;
      }

      this.genAI = new GoogleGenerativeAI(config.ai.google.api_key);
      this.isInitialized = true;
      
      logger.info('Google Gemini embedding service initialized successfully');
    } catch (error) {
      logger.logError(error as Error, 'Failed to initialize embedding service');
      this.isInitialized = false;
    }
  }

  public async createEmbedding(text: string, model = 'text-embedding-004'): Promise<EmbeddingResult> {
    if (!this.isInitialized || !this.genAI) {
      throw new Error('Embedding service is not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding');
    }

    if (text.length > 10000) {
      throw new Error('Text too long for embedding (max: 10000 characters)');
    }

    const startTime = Date.now();

    try {
      // Google Generative AI를 사용하여 임베딩 생성
      const embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
      
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate embedding - empty result');
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = Math.ceil(text.length / 4); // 대략적인 토큰 계산

      logger.info('Embedding created successfully', {
        textLength: text.length,
        embeddingDimension: embedding.length,
        tokensUsed,
        processingTime: `${processingTime}ms`,
        model: 'embedding-001',
      });

      return {
        embedding,
        model: 'embedding-001',
        tokens_used: tokensUsed,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.logError(error as Error, 'Failed to create embedding', {
        textLength: text.length,
        processingTime: `${processingTime}ms`,
        model,
      });
      
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async createEmbeddingBatch(texts: string[], model = 'text-embedding-004'): Promise<EmbeddingBatch> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array is required for batch embedding');
    }

    if (texts.length > 100) {
      throw new Error('Too many texts for batch embedding (max: 100)');
    }

    const startTime = Date.now();
    const embeddings: EmbeddingResult[] = [];
    let totalTokens = 0;

    try {
      // 텍스트들을 병렬로 처리 (동시 요청 수 제한)
      const batchSize = 5; // 동시 요청 수 제한
      const batches: string[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(text => this.createEmbedding(text, model));
        const batchResults = await Promise.all(batchPromises);
        
        embeddings.push(...batchResults);
        totalTokens += batchResults.reduce((sum, result) => sum + result.tokens_used, 0);
      }

      const processingTime = Date.now() - startTime;

      logger.info('Batch embedding completed successfully', {
        textCount: texts.length,
        totalTokens,
        processingTime: `${processingTime}ms`,
        averageTime: `${Math.round(processingTime / texts.length)}ms per text`,
      });

      return {
        embeddings,
        total_tokens: totalTokens,
        processing_time: processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.logError(error as Error, 'Failed to create batch embeddings', {
        textCount: texts.length,
        processingTime: `${processingTime}ms`,
      });
      
      throw new Error(`Batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.genAI !== null;
  }

  public getModelInfo(): {
    provider: string;
    model: string;
    maxInputLength: number;
    dimension: number;
    costPerToken: number;
  } {
    return {
      provider: 'Google Gemini',
      model: 'embedding-001',
      maxInputLength: 10000,
      dimension: 768, // Gemini embedding 차원
      costPerToken: 0.0000125, // 대략적인 비용
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      // 간단한 테스트 임베딩으로 헬스체크
      await this.createEmbedding('health check test');
      return true;
    } catch (error) {
      logger.warn('Embedding service health check failed', error as Record<string, unknown>);
      return false;
    }
  }
}

// 싱글톤 인스턴스 export
export const embeddingService = EmbeddingService.getInstance();