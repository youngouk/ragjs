import axios from 'axios';
import {
  HealthStatus,
  Document,
  ApiDocument,
  UploadResponse,
  UploadStatus,
  ChatResponse,
  Stats,
} from '../types';

// Runtime 설정 타입 정의
declare global {
  interface Window {
    RUNTIME_CONFIG?: {
      API_BASE_URL?: string;
      NODE_ENV?: string;
    };
  }
}

// Railway 배포 최적화 API URL 관리
const getAPIBaseURL = (): string => {
  // 개발 모드: Vite 프록시 활용
  if (import.meta.env.DEV) {
    console.log('🔧 개발 모드: Vite 프록시 사용');
    return '';
  }
  
  // 1순위: Railway 환경변수 (VITE_API_BASE_URL)
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('✅ API URL 소스: Railway 환경변수 (VITE_API_BASE_URL)');
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2순위: 런타임 설정 (동적 변경 가능)
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.API_BASE_URL) {
    console.log('📦 API URL 소스: 런타임 설정 (config.js)');
    return window.RUNTIME_CONFIG.API_BASE_URL;
  }
  
  // 3순위: localhost 폴백 (개발용)
  const fallbackUrl = 'http://localhost:8000';
  
  // 프로덕션 환경 체크
  const isProduction = import.meta.env.PROD || 
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost');
  
  if (isProduction) {
    console.warn(
      '⚠️ Railway 배포 환경 설정 필요:\n' +
      '1. Railway 대시보드에서 VITE_API_BASE_URL 환경변수 설정\n' +
      '2. 또는 public/config.js에서 API_BASE_URL 설정\n' +
      `현재 폴백 URL 사용 중: ${fallbackUrl}`
    );
  } else {
    console.log('🏠 로컬 개발 환경: localhost:8000 사용');
  }
  
  return fallbackUrl;
};

const API_BASE_URL = getAPIBaseURL();

// 최종 API URL 정보 출력
console.log('🚀 API Configuration:', {
  baseURL: API_BASE_URL || 'Using Vite proxy',
  environment: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5분으로 연장 (큰 문서 처리 대응)
  headers: {
    'Content-Type': 'application/json',
  },
  // CORS 설정 추가 - Railway 백엔드 호환성
  withCredentials: false, // CORS 이슈 해결을 위해 credentials 비활성화
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // 세션 ID 추가
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      config.headers['X-Session-Id'] = sessionId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 에러 처리
      localStorage.removeItem('sessionId');
      window.location.href = '/login';
    }
    
    // CORS 오류 상세 로깅
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.warn('🌐 CORS 오류 감지:', {
        message: error.message,
        config: error.config,
        백엔드_URL: API_BASE_URL
      });
    }
    
    return Promise.reject(error);
  }
);

// Health Check API
export const healthAPI = {
  check: () => {
    const healthApi = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000, // 15초로 설정
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    });
    return healthApi.get<HealthStatus>('/health');
  },
};

// 고유한 임시 ID 생성을 위한 카운터
let tempIdCounter = 0;

// API 응답을 UI용 데이터로 변환하는 함수
const transformApiDocument = (apiDoc: ApiDocument): Document => {
  // 백엔드 응답에서 filename이 있으면 사용, 없으면 기본값
  const documentTitle = apiDoc.filename || 'Unknown Document';

  // 날짜 처리: 유효한 날짜인지 확인하고 변환
  const getValidDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      // 1970년 이전이거나 유효하지 않은 날짜인 경우 현재 시간 사용
      if (isNaN(date.getTime()) || date.getFullYear() < 1990) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  return {
    id: apiDoc.id || `temp-${Date.now()}-${++tempIdCounter}-${Math.random().toString(36).substr(2, 9)}`, // 고유한 임시 ID 생성
    filename: documentTitle,
    originalName: documentTitle,
    size: apiDoc.file_size || 0,
    mimeType: 'application/octet-stream', // API에서 제공하지 않으므로 기본값
    uploadedAt: getValidDate(apiDoc.upload_date),
    status: (apiDoc.status as 'processing' | 'completed' | 'failed') || 'completed',
    chunks: apiDoc.chunk_count,
    metadata: {
      wordCount: 0, // 백엔드에서 제공하지 않으므로 기본값
    },
  };
};

// Document API
export const documentAPI = {
  // 문서 목록 조회
  getDocuments: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const response = await api.get<{ documents: ApiDocument[]; total: number }>('/api/upload/documents', { params });
    return {
      ...response,
      data: {
        documents: response.data.documents.map(transformApiDocument),
        total: response.data.total,
      },
    };
  },

  // 문서 상세 조회
  getDocument: (id: string) => api.get<Document>(`/api/upload/documents/${id}`),

  // 문서 업로드
  upload: (file: File, onProgress?: (progress: number) => void, settings?: { splitterType?: string; chunkSize?: number; chunkOverlap?: number }) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // 업로드 설정이 있으면 추가
    if (settings) {
      if (settings.splitterType) {
        formData.append('splitter_type', settings.splitterType);
      }
      if (settings.chunkSize) {
        formData.append('chunk_size', settings.chunkSize.toString());
      }
      if (settings.chunkOverlap) {
        formData.append('chunk_overlap', settings.chunkOverlap.toString());
      }
    }

    return api.post<UploadResponse>('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  // 업로드 상태 확인용 별도 axios 인스턴스
  getUploadStatus: (jobId: string) => {
    const statusApi = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 1분으로 설정
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    });
    return statusApi.get<UploadStatus>(`/api/upload/status/${jobId}`);
  },

  // 문서 삭제 (단일)
  deleteDocument: (id: string) => 
    api.delete(`/api/upload/documents/${id}`),

  // 문서 일괄 삭제
  deleteDocuments: (ids: string[]) => 
    api.post('/api/upload/documents/bulk-delete', { ids }),

  // 전체 문서 삭제
  deleteAllDocuments: (confirmCode: string, reason: string, dryRun?: boolean) => 
    api.delete('/api/documents/all', { 
      params: { dry_run: dryRun || false },
      data: { confirm_code: confirmCode, reason }
    }),

  // 문서 다운로드
  downloadDocument: (id: string) => 
    api.get(`/api/upload/documents/${id}/download`, {
      responseType: 'blob',
    }),
};

// Chat API
export const chatAPI = {
  // 메시지 전송
  sendMessage: (message: string, sessionId?: string) => 
    api.post<ChatResponse>('/api/chat', { 
      message, 
      session_id: sessionId || localStorage.getItem('chatSessionId') 
    }),

  // 채팅 기록 조회
  getChatHistory: (sessionId: string) => 
    api.get<{ messages: ChatResponse[] }>(`/api/chat/history/${sessionId}`),

  // 새 세션 시작
  startNewSession: () => 
    api.post<{ session_id: string }>('/api/chat/session', {}),
};

// Stats API
export const statsAPI = {
  // 전체 통계 조회
  getStats: () => api.get<Stats>('/stats'),

  // 문서 통계 조회
  getDocumentStats: () => api.get<Stats['documents']>('/api/upload/stats'),
};

export default api;