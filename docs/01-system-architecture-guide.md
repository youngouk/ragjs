# Simple RAG 백엔드 시스템 설계 가이드

## 📋 개요

이 문서는 Simple RAG (Retrieval-Augmented Generation) 백엔드 시스템의 설계와 구조를 3개월차 초보 개발자가 이해할 수 있도록 상세히 설명합니다.

## 🏗️ 전체 시스템 아키텍처

### 시스템 구성 요소
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │◄───┤   Backend API   │◄───┤  Vector DB      │
│   (React/Vue)   │    │   (Node.js)     │    │  (Qdrant)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   AI Services   │
                       │ (Google/OpenAI) │
                       └─────────────────┘
```

### 핵심 기능
1. **문서 업로드 및 처리** - PDF, DOCX, TXT 등 다양한 파일 형식 지원
2. **벡터 검색** - 업로드된 문서에서 관련 내용 찾기
3. **AI 응답 생성** - 멀티 LLM 지원 (Google Gemini, OpenAI, Anthropic, Cohere)
4. **세션 관리** - 대화 상태 유지 및 히스토리 관리

## 📁 프로젝트 폴더 구조

```
apps/backend/
├── src/
│   ├── app.ts                 # 메인 애플리케이션 진입점
│   ├── config/
│   │   └── index.ts          # 환경 설정 관리
│   ├── types/
│   │   └── index.ts          # TypeScript 타입 정의
│   ├── utils/
│   │   └── logger.ts         # 로깅 시스템
│   ├── middleware/
│   │   └── index.ts          # Express 미들웨어
│   ├── routes/               # API 엔드포인트
│   │   ├── health.ts         # 시스템 상태 확인
│   │   ├── upload.ts         # 파일 업로드
│   │   ├── chat.ts           # 채팅 API
│   │   └── stats.ts          # 통계 정보
│   └── services/             # 비즈니스 로직
│       ├── DocumentProcessor.ts  # 문서 처리
│       ├── EmbeddingService.ts   # 임베딩 생성
│       ├── VectorService.ts      # 벡터 DB 관리
│       └── GenerationService.ts  # AI 응답 생성
├── dist/                     # 컴파일된 JavaScript 파일
├── package.json              # 의존성 관리
├── tsconfig.json            # TypeScript 설정
└── docker-compose.yml       # Docker 환경 설정
```

## 🔧 주요 모듈 상세 설명

### 1. 메인 애플리케이션 (app.ts)
- **역할**: Express 서버 설정 및 시작점
- **주요 기능**:
  - 미들웨어 설정 (보안, CORS, 압축, 로깅)
  - 라우터 연결
  - 서버 시작 및 종료 관리
  - 환경 검증

```typescript
// 서버 시작 예시
const server = new SimpleRAGServer();
server.start(); // 포트 8000에서 서버 시작
```

### 2. 설정 관리 (config/index.ts)
- **역할**: 환경 변수와 설정 값 관리
- **주요 설정**:
  - AI 서비스 API 키 (Google, OpenAI, Anthropic, Cohere)
  - 벡터 데이터베이스 연결 정보
  - 파일 업로드 제한 및 허용 형식
  - 세션 TTL 및 로깅 설정

```typescript
// 설정 사용 예시
const config = {
  server: { port: 8000, host: '0.0.0.0' },
  ai: { google: { api_key: 'your-key' } },
  vector_db: { url: 'http://localhost:6333' }
};
```

### 3. 타입 정의 (types/index.ts)
- **역할**: TypeScript 타입 안전성 제공
- **주요 타입**:
  - `ChatMessage`: 채팅 메시지 구조
  - `DocumentChunk`: 문서 청크 정보
  - `UploadResponse`: 업로드 응답 형식
  - `GenerationResult`: AI 응답 결과

### 4. 미들웨어 (middleware/index.ts)
- **역할**: 요청/응답 처리 파이프라인
- **포함 기능**:
  - CORS 설정 (Cross-Origin Resource Sharing)
  - 보안 헤더 설정 (Helmet)
  - 요청 로깅
  - 에러 처리
  - 응답 압축

## 🚀 API 엔드포인트

### 1. 건강 상태 확인 (health.ts)
```
GET /health
```
- 시스템 상태와 연결된 서비스 확인
- AI 서비스, 벡터 DB 연결 상태 체크

### 2. 파일 업로드 (upload.ts)
```
POST /api/upload              # 파일 업로드
GET  /api/upload/status/:jobId # 처리 상태 확인
GET  /api/upload/documents     # 업로드된 문서 목록
DELETE /api/upload/documents/:id # 문서 삭제
```

### 3. 채팅 (chat.ts)
```
POST /api/chat                    # 메시지 전송
GET  /api/chat/history/:sessionId # 대화 히스토리
POST /api/chat/session            # 새 세션 생성
```

### 4. 통계 (stats.ts)
```
GET /stats # 시스템 사용 통계
```

## 🧩 서비스 레이어

### 1. DocumentProcessor (문서 처리 서비스)
- **역할**: 업로드된 파일을 텍스트로 변환하고 청크로 분할
- **지원 파일**: PDF, DOCX, TXT, XLSX, CSV
- **핵심 기능**:
  - 파일 형식별 텍스트 추출
  - 청크 분할 (기본 1000자, 200자 오버랩)
  - 메타데이터 추출

### 2. EmbeddingService (임베딩 서비스)
- **역할**: 텍스트를 벡터로 변환
- **사용 모델**: Google Gemini embedding-001 (768차원)
- **기능**:
  - 단일/배치 임베딩 생성
  - 토큰 사용량 추적

### 3. VectorService (벡터 DB 서비스)
- **역할**: Qdrant 벡터 데이터베이스 관리
- **기능**:
  - 문서 청크 저장
  - 유사도 검색 (코사인 유사도)
  - 컬렉션 관리

### 4. GenerationService (AI 응답 생성 서비스)
- **역할**: 다중 LLM 프로바이더를 통한 응답 생성
- **지원 모델**:
  - Google Gemini
  - OpenAI GPT
  - Anthropic Claude
  - Cohere Command
- **기능**:
  - 자동 프로바이더 선택
  - 토큰 사용량 추적
  - 에러 처리 및 폴백

## 💾 데이터 흐름

### 파일 업로드 흐름
1. 사용자가 파일 업로드 → `upload.ts`
2. Multer가 파일 저장 → `uploads/` 폴더
3. 백그라운드에서 `DocumentProcessor` 실행
4. 텍스트 추출 및 청크 분할
5. `EmbeddingService`로 임베딩 생성
6. `VectorService`로 Qdrant에 저장
7. 처리 완료 상태 업데이트

### 채팅 질의 흐름
1. 사용자 질문 → `chat.ts`
2. `VectorService`로 관련 문서 검색
3. 검색 결과와 대화 히스토리 조합
4. `GenerationService`로 AI 응답 생성
5. 응답을 세션에 저장하고 반환

## 🔒 보안 및 성능

### 보안 기능
- Helmet을 통한 보안 헤더 설정
- CORS 설정으로 허용된 도메인만 접근
- 파일 크기 및 형식 제한
- Rate limiting으로 과도한 요청 방지

### 성능 최적화
- 응답 압축 (gzip)
- 요청 로깅 및 모니터링
- 세션 자동 정리 (1시간 TTL)
- 배치 임베딩 처리

## 📊 모니터링 및 로깅

### 로깅 시스템
- Winston을 사용한 구조화된 로깅
- 로그 레벨: error, warn, info, debug
- 파일과 콘솔 출력 지원

### 헬스체크
- `/health` 엔드포인트로 시스템 상태 확인
- AI 서비스 연결 상태 모니터링
- 벡터 DB 연결 상태 확인

## 🚀 개발 환경 설정

### 필수 환경 변수
```bash
# AI 서비스 API 키 (최소 하나 필요)
GOOGLE_AI_API_KEY=your_google_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
COHERE_API_KEY=your_cohere_key

# 벡터 데이터베이스
QDRANT_URL=http://localhost:6333

# 서버 설정
PORT=8000
HOST=0.0.0.0
```

### 개발 명령어
```bash
npm run dev      # 개발 서버 실행
npm run build    # TypeScript 컴파일
npm run start    # 프로덕션 서버 실행
npm test         # 테스트 실행
```

이 시스템은 모듈화된 설계로 각 서비스가 독립적으로 동작하며, 확장과 유지보수가 용이한 구조로 되어 있습니다.