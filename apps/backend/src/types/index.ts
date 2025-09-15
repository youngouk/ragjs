// 전역 타입 정의 - Python FastAPI 모델과 호환
import type { Request } from 'express';

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    llm: boolean;
    vector: boolean;
    session: boolean;
  };
}

// Document Types (Python의 ApiDocument와 호환)
export interface ApiDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  status: string;
  chunk_count: number;
  processing_time?: number | null;
  error_message?: string | null;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'failed';
  chunks?: number;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
  };
}

export interface UploadResponse {
  success: boolean;
  jobId: string;
  message: string;
  document?: ApiDocument;
}

export interface UploadStatus {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  progress: number;
  message: string;
  filename?: string;
  document_id?: string;
  error?: string;
}

// Chat Types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  sources: DocumentChunk[];
  tokens_used?: number;
  processing_time?: number;
  model_used?: string;
}

export interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_id: string;
    score?: number;
  };
}

// Session Types
export interface ConversationSession {
  session_id: string;
  created_at: string;
  last_activity: string;
  message_count: number;
  history: ChatMessage[];
}

// Vector Search Types
export interface VectorSearchResult {
  id: string;
  score: number;
  payload: {
    content: string;
    metadata: Record<string, unknown>;
  };
}

export interface SearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

// AI Service Types
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface GenerationOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
}

export interface LLMProvider {
  name: string;
  model: string;
  available: boolean;
  cost_per_token: number;
}

// Configuration Types
export interface AppConfig {
  server: {
    port: number;
    host: string;
    cors_origins: string[];
  };
  ai: {
    google: {
      api_key: string;
      model: string;
    };
    openai: {
      api_key: string;
      model: string;
    };
    anthropic: {
      api_key: string;
      model: string;
    };
    cohere: {
      api_key: string;
      model: string;
    };
  };
  vector_db: {
    url: string;
    api_key?: string;
    collection_name: string;
  };
  upload: {
    max_file_size: number;
    allowed_types: string[];
    upload_dir: string;
  };
  session: {
    ttl: number;
    cleanup_interval: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

// Stats Types
export interface Stats {
  server: {
    uptime: number;
    memory_usage: {
      used: number;
      total: number;
    };
    cpu_usage: number;
  };
  documents: {
    total_documents: number;
    total_chunks: number;
    storage_used: number;
    processing_queue: number;
  };
  requests: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    average_response_time: number;
  };
  ai_usage: {
    tokens_used: number;
    cost_estimated: number;
    models_used: Record<string, number>;
  };
}

// Error Types
export interface APIError {
  success: false;
  error: string;
  code: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Middleware Types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    session_id: string;
  };
}

// File Processing Types
export interface FileProcessingJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  completed_at?: string;
  error?: string;
  chunks_created?: number;
  document_id?: string;
}