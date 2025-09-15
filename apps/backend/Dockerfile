# Simple RAG Node.js Backend - Docker Configuration

# 멀티 스테이지 빌드를 사용하여 이미지 크기 최적화
FROM node:20-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 정보 복사 및 전체 의존성 설치 (빌드용)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 불필요한 devDependencies 제거
RUN npm prune --omit=dev

# 프로덕션 스테이지
FROM node:20-alpine AS production

# 비특권 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 필요한 시스템 패키지 설치
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# 작업 디렉토리 설정
WORKDIR /app

# 빌더 스테이지에서 필요한 파일들 복사
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# 로그 및 업로드 디렉토리 생성
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# 비특권 사용자로 전환
USER nodejs

# 환경 변수 설정
ENV NODE_ENV=production
ENV SERVER_PORT=8000
ENV SERVER_HOST=0.0.0.0

# 포트 노출
EXPOSE 8000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 애플리케이션 시작
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]

# 레이블 추가
LABEL name="simple-rag-nodejs"
LABEL description="Simple RAG Chatbot - Node.js Backend (migrated from Python FastAPI)"
LABEL version="1.0.0"
LABEL author="Simple RAG Team"