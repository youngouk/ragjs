# Simple RAG Monorepo

> **완전한 JavaScript/TypeScript 기반 RAG (Retrieval-Augmented Generation) 챗봇 시스템**

Python FastAPI에서 Node.js로 완전 마이그레이션된 풀스택 모노레포입니다. React 프론트엔드와 Node.js 백엔드가 하나의 레포지토리에서 관리됩니다.

## 🏗 아키텍처

```
simple-rag-monorepo/
├── apps/
│   ├── frontend/          # React + TypeScript + Vite
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── backend/           # Node.js + Express + TypeScript
│       ├── src/
│       │   ├── services/  # AI/ML 서비스
│       │   ├── routes/    # API 라우터
│       │   └── middleware/
│       ├── package.json
│       └── Dockerfile
├── docker-compose.yml     # 전체 스택 오케스트레이션
├── package.json          # 워크스페이스 설정
└── README.md
```

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
# 루트에서 모든 앱의 의존성을 한 번에 설치
npm install
```

### 2. 환경 설정
```bash
# 환경 파일 복사 및 설정
npm run setup:env

# API 키 설정
# - apps/backend/.env 파일에서 AI 서비스 API 키 설정
# - apps/frontend/.env 파일에서 백엔드 URL 설정
```

### 3. 개발 서버 실행
```bash
# 프론트엔드 + 백엔드 동시 실행 (권장)
npm run dev

# 개별 실행
npm run dev:frontend  # React 개발 서버
npm run dev:backend   # Node.js 개발 서버
```

### 4. Docker로 전체 스택 실행
```bash
# Qdrant, 백엔드, 프론트엔드 모두 실행
npm run docker:up
```

## 📱 애플리케이션

### 🎨 Frontend (React + TypeScript)
- **위치**: `apps/frontend/`
- **기술 스택**: React 18, TypeScript, Vite, TailwindCSS
- **포트**: http://localhost:3000
- **특징**:
  - 반응형 디자인
  - 실시간 채팅 인터페이스
  - 문서 업로드 및 관리
  - 다크모드 지원
  - PWA 지원

### 🔧 Backend (Node.js + Express)
- **위치**: `apps/backend/`
- **기술 스택**: Node.js 18+, Express, TypeScript, Winston
- **포트**: http://localhost:8000
- **특징**:
  - RESTful API
  - 멀티-LLM 지원 (Google, OpenAI, Anthropic, Cohere)
  - Qdrant 벡터 검색
  - 실시간 문서 처리
  - 구조화된 로깅

## 🛠 개발 명령어

### 전체 프로젝트
```bash
npm run dev          # 전체 개발 서버 실행
npm run build        # 전체 빌드
npm run test         # 전체 테스트
npm run lint         # 전체 린팅
npm run lint:fix     # 린트 오류 자동 수정
npm run clean        # 빌드 파일 정리
npm run setup        # 초기 설정
```

### 프론트엔드
```bash
npm run dev:frontend      # React 개발 서버
npm run build:frontend    # 프로덕션 빌드
npm run test:frontend     # Jest + Testing Library
npm run lint:frontend     # ESLint 체크
```

### 백엔드
```bash
npm run dev:backend       # Node.js 개발 서버 (Hot reload)
npm run build:backend     # TypeScript 컴파일
npm run start:backend     # 프로덕션 실행
npm run lint:backend      # ESLint 체크
```

### Docker
```bash
npm run docker:build     # 이미지 빌드
npm run docker:up        # 전체 스택 실행
npm run docker:down      # 전체 스택 종료
npm run docker:logs      # 로그 확인
```

## 🌐 API 엔드포인트

### 기본 정보
- **Base URL**: `http://localhost:8000`
- **API 문서**: `GET /info`
- **Health Check**: `GET /health`

### 주요 엔드포인트
```http
# 문서 관리
POST   /api/upload                    # 문서 업로드
GET    /api/upload/status/:jobId      # 처리 상태 확인
GET    /api/upload/documents          # 문서 목록
DELETE /api/upload/documents/:id      # 문서 삭제

# 채팅 & RAG
POST   /api/chat                      # 채팅 메시지 전송
GET    /api/chat/history/:sessionId   # 대화 이력
POST   /api/chat/session              # 새 세션 시작

# 모니터링
GET    /stats                         # 시스템 통계
GET    /stats/documents               # 문서 통계
GET    /stats/ai-usage                # AI 사용량
```

## 🔧 환경 설정

### Backend 환경 변수 (`apps/backend/.env`)
```env
# 필수: AI 서비스 API 키
GOOGLE_AI_API_KEY=your_google_ai_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
COHERE_API_KEY=your_cohere_api_key

# 필수: 벡터 데이터베이스
QDRANT_URL=http://localhost:6333

# 서버 설정
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

### Frontend 환경 변수 (`apps/frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_APP_NAME=Simple RAG Chatbot
```

## 🐳 Docker 배포

### 개발 환경
```bash
# 전체 스택 (Qdrant + Backend + Frontend)
docker-compose up -d

# 개별 서비스
docker-compose up -d qdrant    # 벡터 DB만
docker-compose up -d backend   # 백엔드만
docker-compose up -d frontend  # 프론트엔드만
```

### 프로덕션 배포
```bash
# 프로덕션 빌드
NODE_ENV=production npm run build

# 프로덕션 Docker 실행
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 테스팅

### 프론트엔드 테스트
```bash
cd apps/frontend
npm test              # Jest + Testing Library
npm run test:watch    # Watch 모드
npm run test:coverage # 커버리지 리포트
```

### 백엔드 테스트
```bash
cd apps/backend
npm test              # Jest + Supertest
npm run test:watch    # Watch 모드
npm run test:integration # 통합 테스트
```

## 📦 빌드 & 배포

### 개발 빌드
```bash
npm run build
```

### 프로덕션 배포
```bash
# 1. 환경 설정
NODE_ENV=production

# 2. 빌드
npm run build

# 3. 백엔드 실행
cd apps/backend
npm start

# 4. 프론트엔드 서빙 (Nginx 권장)
cd apps/frontend
# dist/ 폴더를 웹서버에서 서빙
```

## 🔄 마이그레이션 정보

### Python FastAPI → Node.js 전환 완료
- ✅ **100% API 호환성**: 기존 프론트엔드 무수정 사용
- ✅ **성능 향상**: Node.js 비동기 처리
- ✅ **타입 안정성**: TypeScript 완전 지원
- ✅ **개발 경험**: Hot reload, 자동 완성
- ✅ **배포 간소화**: Docker 기반 통합

### 주요 개선사항
1. **통합 개발 환경**: 모노레포로 프론트엔드/백엔드 통합 관리
2. **향상된 성능**: Node.js 이벤트 루프 기반 높은 동시성
3. **타입 안전성**: 전체 코드베이스 TypeScript 적용
4. **개발자 경험**: Hot reload, 자동 완성, 디버깅 개선
5. **배포 편의성**: Docker Compose 기반 원클릭 배포

## 🤝 기여 가이드

1. **브랜치 생성**: `git checkout -b feature/amazing-feature`
2. **코드 작성**: 해당 앱 디렉토리에서 개발
3. **테스트**: `npm run test` 
4. **린팅**: `npm run lint:fix`
5. **커밋**: `git commit -m 'feat: add amazing feature'`
6. **푸시**: `git push origin feature/amazing-feature`
7. **PR 생성**: GitHub에서 Pull Request 생성

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 🆘 문제 해결

### 일반적인 문제

#### 1. 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -ti:3000 -ti:8000 -ti:6333

# 프로세스 종료
kill -9 $(lsof -ti:3000)
```

#### 2. 의존성 문제
```bash
# 전체 정리 후 재설치
npm run clean:all
npm install
```

#### 3. Docker 문제
```bash
# 컨테이너 정리
docker-compose down -v
docker system prune -f
npm run docker:up
```

### 로그 확인
```bash
# 개발 모드
npm run dev              # 콘솔에서 실시간 로그

# 백엔드 로그
tail -f apps/backend/logs/app.log

# Docker 로그
npm run docker:logs
```

## 📞 지원

- **Issues**: [GitHub Issues](https://github.com/youngouk/ragjs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/youngouk/ragjs/discussions)

---

**Simple RAG Team** | Full-Stack JavaScript Monorepo 2025