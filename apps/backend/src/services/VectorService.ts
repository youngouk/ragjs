import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import { embeddingService, EmbeddingResult } from '@/services/EmbeddingService';

const logger = getLogger('VectorService');

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index: number;
    chunk_size: number;
    document_id: string;
    file_type: string;
    created_at: string;
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    page?: number;
    chunk_id: string;
    score: number;
    [key: string]: any;
  };
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, any>;
}

export interface VectorStats {
  total_vectors: number;
  collection_size: number;
  indexed_points: number;
  vector_dimension: number;
}

export class VectorService {
  private static instance: VectorService;
  private client: QdrantClient | null = null;
  private isInitialized = false;
  private readonly collectionName = 'documents';

  private constructor() {
    this.initialize();
  }

  public static getInstance(): VectorService {
    if (!VectorService.instance) {
      VectorService.instance = new VectorService();
    }
    return VectorService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      if (!config.vector_db.url) {
        logger.warn('Vector database URL not configured, using memory store');
        return;
      }

      // Qdrant 클라이언트 초기화
      this.client = new QdrantClient({
        url: config.vector_db.url,
        ...(config.vector_db.api_key && { apiKey: config.vector_db.api_key }),
      });

      // 컬렉션 존재 여부 확인 및 생성
      await this.ensureCollection();
      
      this.isInitialized = true;
      logger.info('Vector service initialized successfully', {
        url: config.vector_db.url,
        collection: this.collectionName,
      });

    } catch (error) {
      logger.logError(error as Error, 'Failed to initialize vector service');
      this.isInitialized = false;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      // 컬렉션 존재 여부 확인
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!collectionExists) {
        // 컬렉션 생성 (768차원은 Gemini embedding 차원)
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Gemini embedding 차원
            distance: 'Cosine', // 코사인 유사도 사용
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        logger.info('Vector collection created', {
          collection: this.collectionName,
          dimension: 768,
          distance: 'Cosine',
        });
      } else {
        logger.info('Vector collection already exists', {
          collection: this.collectionName,
        });
      }
    } catch (error) {
      logger.logError(error as Error, 'Failed to ensure collection exists');
      throw error;
    }
  }

  public async addDocuments(chunks: DocumentChunk[]): Promise<number> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No document chunks provided');
    }

    const startTime = Date.now();
    let addedCount = 0;

    try {
      // 청크들을 배치로 처리 (한 번에 100개씩)
      const batchSize = 100;
      const batches: DocumentChunk[][] = [];
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        batches.push(chunks.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        // 배치에 대해 임베딩 생성
        const texts = batch.map(chunk => chunk.content);
        const embeddingResult = await embeddingService.createEmbeddingBatch(texts);

        // Qdrant에 점들을 추가할 준비
        const points = batch.map((chunk, index) => ({
          id: chunk.id,
          vector: embeddingResult.embeddings[index]?.embedding || [],
          payload: {
            content: chunk.content,
            ...chunk.metadata,
          },
        }));

        // Qdrant에 점들 추가
        await this.client.upsert(this.collectionName, {
          wait: true,
          points,
        });

        addedCount += batch.length;
      }

      const processingTime = Date.now() - startTime;

      logger.info('Documents added to vector database', {
        chunksAdded: addedCount,
        totalChunks: chunks.length,
        processingTime: `${processingTime}ms`,
        averageTime: `${Math.round(processingTime / chunks.length)}ms per chunk`,
      });

      return addedCount;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.logError(error as Error, 'Failed to add documents to vector database', {
        chunksProcessed: addedCount,
        totalChunks: chunks.length,
        processingTime: `${processingTime}ms`,
      });
      
      throw new Error(`Failed to add documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    const startTime = Date.now();
    const searchOptions = {
      limit: options.limit || 5,
      threshold: options.threshold || 0.7,
      filter: options.filter,
    };

    try {
      // 쿼리에 대한 임베딩 생성
      const queryEmbedding = await embeddingService.createEmbedding(query);

      // Qdrant에서 유사한 벡터 검색
      const searchParams: any = {
        vector: queryEmbedding.embedding,
        limit: searchOptions.limit,
        score_threshold: searchOptions.threshold,
        with_payload: true,
      };
      
      if (searchOptions.filter) {
        searchParams.filter = searchOptions.filter;
      }
      
      const searchResult = await this.client.search(this.collectionName, searchParams);

      // 검색 결과를 표준 형식으로 변환
      const results: SearchResult[] = searchResult.map((hit) => ({
        id: hit.id.toString(),
        content: hit.payload?.content as string || '',
        score: hit.score,
        metadata: {
          source: hit.payload?.source as string || '',
          page: hit.payload?.page as number,
          chunk_id: hit.id.toString(),
          score: hit.score,
          ...hit.payload,
        },
      }));

      const processingTime = Date.now() - startTime;

      logger.info('Vector search completed', {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        resultsFound: results.length,
        limit: searchOptions.limit,
        threshold: searchOptions.threshold,
        processingTime: `${processingTime}ms`,
      });

      return results;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.logError(error as Error, 'Vector search failed', {
        query: query.substring(0, 100),
        options: searchOptions,
        processingTime: `${processingTime}ms`,
      });
      
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    try {
      // 문서 ID로 모든 관련 청크 삭제
      const deleteResult = await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'document_id',
              match: { value: documentId },
            },
          ],
        },
      });

      logger.info('Document deleted from vector database', {
        documentId,
        operation_id: deleteResult.operation_id,
      });

      return true;

    } catch (error) {
      logger.logError(error as Error, 'Failed to delete document from vector database', {
        documentId,
      });
      return false;
    }
  }

  public async deleteChunks(chunkIds: string[]): Promise<number> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    if (!chunkIds || chunkIds.length === 0) {
      return 0;
    }

    try {
      // 청크 ID들로 직접 삭제
      const deleteResult = await this.client.delete(this.collectionName, {
        points: chunkIds,
      });

      logger.info('Chunks deleted from vector database', {
        chunkIds: chunkIds.length,
        operation_id: deleteResult.operation_id,
      });

      return chunkIds.length;

    } catch (error) {
      logger.logError(error as Error, 'Failed to delete chunks from vector database', {
        chunkCount: chunkIds.length,
      });
      return 0;
    }
  }

  public async getStats(): Promise<VectorStats> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    try {
      const collectionInfo = await this.client.getCollection(this.collectionName);
      
      const vectorConfig = collectionInfo.config.params.vectors;
      let vectorDimension = 768;
      
      if (typeof vectorConfig === 'object' && vectorConfig && 'size' in vectorConfig) {
        vectorDimension = typeof vectorConfig.size === 'number' ? vectorConfig.size : 768;
      }
      
      return {
        total_vectors: collectionInfo.points_count || 0,
        collection_size: collectionInfo.points_count || 0,
        indexed_points: collectionInfo.indexed_vectors_count || 0,
        vector_dimension: vectorDimension,
      };

    } catch (error) {
      logger.logError(error as Error, 'Failed to get vector database stats');
      return {
        total_vectors: 0,
        collection_size: 0,
        indexed_points: 0,
        vector_dimension: 768,
      };
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.client) {
        return false;
      }

      // 컬렉션 정보 조회로 연결 상태 확인
      await this.client.getCollection(this.collectionName);
      return true;

    } catch (error) {
      logger.warn('Vector service health check failed', error as Record<string, unknown>);
      return false;
    }
  }

  public async clearCollection(): Promise<boolean> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Vector service is not initialized');
    }

    try {
      // 컬렉션 삭제 후 재생성
      await this.client.deleteCollection(this.collectionName);
      await this.ensureCollection();
      
      logger.info('Vector collection cleared and recreated');
      return true;

    } catch (error) {
      logger.logError(error as Error, 'Failed to clear vector collection');
      return false;
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }
}

// 싱글톤 인스턴스 export
export const vectorService = VectorService.getInstance();