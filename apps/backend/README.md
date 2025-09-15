# Simple RAG Node.js Backend

> **Python FastAPI에서 Node.js/Express/TypeScript로 완전 마이그레이션된 RAG (Retrieval-Augmented Generation) 챗봇 백엔드**

기존 React 프론트엔드와 100% 호환되는 고성능 Node.js 백엔드 시스템입니다.

## 🚀 주요 기능

### 핵심 RAG 파이프라인
- **문서 업로드 & 처리**: PDF, TXT, DOCX, XLSX, CSV 파일 지원
- **벡터 검색**: Qdrant를 활용한 고성능 의미적 검색
- **멀티-LLM 생성**: Google Gemini, OpenAI, Anthropic, Cohere 지원
- **세션 관리**: TTL 기반 대화 이력 관리

### 기술적 특징
- **TypeScript 완전 지원**: 타입 안정성과 개발자 경험 향상
- **모듈러 아키텍처**: 서비스별 분리된 구조로 유지보수성 극대화
- **싱글톤 패턴**: 리소스 효율적인 서비스 관리
- **구조화된 로깅**: Winston 기반 전문적 로깅 시스템
- **포괄적 에러 핸들링**: 사용자 친화적 에러 응답

### 성능 & 보안
- **미들웨어 스택**: CORS, 보안, 압축, 속도 제한
- **Graceful Shutdown**: 안전한 서버 종료 처리
- **Health Check**: 서비스별 상태 모니터링
- **Docker 지원**: 컨테이너 기반 배포

## 📋 시스템 요구사항

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Qdrant**: >= 1.7.0 (벡터 데이터베이스)

## 🛠 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에서 다음 항목들을 설정하세요:

```env
# 필수: AI 서비스 API 키
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
COHERE_API_KEY=your_cohere_api_key_here

# 필수: Qdrant 벡터 데이터베이스
QDRANT_URL=http://localhost:6333

# 선택사항: 서버 구성
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

### 3. Qdrant 벡터 데이터베이스 설정

#### Docker로 실행 (권장)
```bash
docker run -p 6333:6333 qdrant/qdrant:v1.7.4
```

#### Docker Compose로 전체 스택 실행
```bash
docker-compose up -d
```

## 🚀 실행

### 개발 모드
```bash
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
npm start
```

### Docker 실행
```bash
# 백엔드만 실행
docker build -t simple-rag-nodejs .
docker run -p 8000:8000 simple-rag-nodejs

# 전체 스택 실행 (Qdrant, Redis 포함)
docker-compose up -d
```

## 📡 API 엔드포인트

### 기본 정보
- **Base URL**: `http://localhost:8000`
- **API 정보**: `GET /info`
- **Health Check**: `GET /health`

### 문서 관리
```http
POST /api/upload                    # 문서 업로드
GET  /api/upload/status/:jobId      # 처리 상태 확인
GET  /api/upload/documents          # 문서 목록
DELETE /api/upload/documents/:id    # 문서 삭제
POST /api/upload/documents/bulk-delete  # 일괄 삭제
```

### 채팅 & RAG
```http
POST /api/chat                      # 채팅 메시지 전송
GET  /api/chat/history/:sessionId   # 대화 이력 조회
POST /api/chat/session              # 새 세션 시작
DELETE /api/chat/session/:sessionId # 세션 삭제
```

### 통계 & 모니터링
```http
GET /stats                          # 전체 시스템 통계
GET /stats/documents                # 문서 관련 통계
GET /stats/ai-usage                 # AI 사용 통계
```

## 🏗 아키텍처

```
simple-rag-nodejs/
├── src/
│   ├── app.ts              # 메인 Express 애플리케이션
│   ├── config/             # 환경 설정 관리
│   ├── middleware/         # Express 미들웨어
│   ├── routes/             # API 라우터
│   ├── services/           # 비즈니스 로직
│   │   ├── EmbeddingService.ts    # Google Gemini 임베딩
│   │   ├── GenerationService.ts   # 멀티-LLM 생성
│   │   ├── VectorService.ts       # Qdrant 벡터 검색
│   │   └── DocumentProcessor.ts   # 문서 처리 파이프라인
│   ├── types/              # TypeScript 타입 정의
│   └── utils/              # 유틸리티 함수
├── dist/                   # 컴파일된 JavaScript
├── uploads/                # 업로드된 파일
├── logs/                   # 로그 파일
└── docker-compose.yml      # Docker 스택 구성
```

## 🧪 테스트

```bash
# 단위 테스트 실행
npm test

# 감시 모드로 테스트
npm run test:watch

# 커버리지 리포트
npm run test:coverage

# 린팅
npm run lint
npm run lint:fix
```

## 🔧 개발

### TypeScript 컴파일
```bash
npm run build
```

### 개발 서버 (Hot Reload)
```bash
npm run dev
```

### 코드 품질
```bash
npm run lint         # ESLint 검사
npm run lint:fix     # 자동 수정
```

## 📊 모니터링

### Health Check 엔드포인트
```http
GET /health
```

**응답 예시**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T...",
  "uptime": 3600,
  "services": {
    "llm": true,
    "vector": true,
    "session": true
  }
}
```

### 통계 엔드포인트
```http
GET /stats
```

**응답 예시**:
```json
{
  "server": { "uptime": 3600, "memory_usage": {...} },
  "documents": { "total_documents": 25, "total_chunks": 245 },
  "requests": { "total_requests": 1000, "successful_requests": 985 },
  "ai_usage": { "tokens_used": 50000, "cost_estimated": 12.50 }
}
```

## 🌐 배포

### Docker 배포 (권장)
```bash
# 프로덕션 이미지 빌드
docker build -t simple-rag-nodejs:latest .

# 전체 스택 배포
docker-compose -f docker-compose.yml up -d
```

### 기존 서버 배포
```bash
# 프로덕션 빌드
npm run build

# PM2로 프로세스 관리 (권장)
npm install -g pm2
pm2 start dist/app.js --name simple-rag-api

# 또는 직접 실행
NODE_ENV=production npm start
```

## 🔗 Python FastAPI 호환성

이 Node.js 백엔드는 기존 Python FastAPI 시스템과 **100% API 호환**됩니다:

- ✅ 동일한 엔드포인트 구조
- ✅ 동일한 요청/응답 형식
- ✅ 동일한 에러 코드 및 메시지
- ✅ 기존 React 프론트엔드 무수정 지원

### 마이그레이션 개선사항
- **성능**: Node.js 비동기 처리로 향상된 동시성
- **타입 안정성**: TypeScript 완전 지원
- **개발 경험**: Hot reload, 자동 완성 개선
- **리소스 효율성**: 메모리 사용량 최적화
- **배포 편의성**: Docker 기반 간소화된 배포

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 🆘 문제 해결

### 일반적인 문제들

#### 1. AI 서비스 연결 실패
```bash
# API 키 확인
echo $GOOGLE_AI_API_KEY

# 헬스체크로 상태 확인
curl http://localhost:8000/health
```

#### 2. Qdrant 연결 실패
```bash
# Qdrant 컨테이너 상태 확인
docker ps | grep qdrant

# Qdrant 헬스체크
curl http://localhost:6333/health
```

#### 3. 파일 업로드 실패
```bash
# 업로드 디렉토리 권한 확인
ls -la uploads/

# 디렉토리 생성
mkdir -p uploads logs
```

### 로그 확인
```bash
# 개발 모드에서 콘솔 로그 확인
npm run dev

# 프로덕션 로그 파일 확인
tail -f logs/app.log

# Docker 로그 확인
docker logs simple-rag-api
```

## 📞 지원

질문이나 문제가 있으시면 GitHub Issues를 통해 문의해주세요.

---

**Simple RAG Team** | Node.js Migration 2025-01-14