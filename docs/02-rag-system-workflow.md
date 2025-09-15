# RAG 시스템 동작 구조 가이드

## 📋 개요

이 문서는 Simple RAG 시스템에서 사용자 질문이 어떻게 처리되어 최종 답변이 생성되는지를 초보 개발자가 이해할 수 있도록 단계별로 설명합니다.

## 🔄 RAG 시스템의 전체 동작 흐름

### RAG란?
**Retrieval-Augmented Generation**의 줄임말로, 다음 두 단계로 구성됩니다:
1. **Retrieval (검색)**: 관련 문서를 찾기
2. **Generation (생성)**: 찾은 문서를 바탕으로 답변 생성

```
사용자 질문 → 벡터 검색 → 관련 문서 찾기 → AI가 답변 생성 → 사용자에게 응답
```

## 🚀 실제 사용자 질의 처리 과정

### 시나리오: 사용자가 "프로젝트 예산은 얼마나 되나요?"라고 질문

#### 1단계: 사용자 입력 접수 및 검증
**위치**: `src/routes/chat.ts` - POST `/api/chat`

```typescript
// 사용자 메시지 검증
if (!message || message.trim().length === 0) {
  return res.error('Message is required');
}

// 메시지 길이 제한 (4000자)
if (message.length > 4000) {
  return res.error('Message too long');
}
```

**처리 내용**:
- 빈 메시지인지 확인
- 메시지 길이가 4000자 이하인지 검증
- 세션 ID가 있으면 기존 대화 이어가기, 없으면 새 세션 생성

#### 2단계: 세션 관리
**위치**: `src/routes/chat.ts` - 세션 처리 로직

```typescript
// 기존 세션 찾기 또는 새 세션 생성
let session = sessions.get(sessionId);
if (!session) {
  session = {
    session_id: sessionId,
    created_at: new Date().toISOString(),
    history: [],
    message_count: 0
  };
}

// 사용자 메시지를 히스토리에 추가
const userMessage = {
  role: 'user',
  content: message,
  timestamp: new Date().toISOString()
};
session.history.push(userMessage);
```

**처리 내용**:
- 세션 ID로 기존 대화 찾기
- 새 세션이면 생성
- 사용자 메시지를 대화 히스토리에 저장

#### 3단계: 벡터 검색 (Retrieval)
**위치**: `src/routes/chat.ts` - `performVectorSearch()` 함수

```typescript
async function performVectorSearch(query: string) {
  // 1. 벡터 서비스 연결 확인
  if (!vectorService.isAvailable()) {
    return []; // 빈 결과 반환
  }

  // 2. Qdrant에서 유사한 문서 검색
  const searchResults = await vectorService.search(query, {
    limit: 5,        // 최대 5개 문서
    threshold: 0.7   // 유사도 70% 이상
  });

  return searchResults;
}
```

**세부 동작 과정**:

**3-1. 질문 임베딩 생성**
**위치**: `src/services/VectorService.ts` - `search()` 메서드

```typescript
// 사용자 질문을 벡터로 변환
const queryEmbedding = await embeddingService.createEmbedding(query);
// "프로젝트 예산은 얼마나 되나요?" → [0.1, 0.3, -0.2, ..., 0.5] (768차원)
```

**3-2. Qdrant에서 유사도 검색**
```typescript
const searchParams = {
  vector: queryEmbedding.embedding,  // 질문의 벡터
  limit: 5,                         // 최대 5개 결과
  score_threshold: 0.7,            // 유사도 70% 이상만
  with_payload: true               // 메타데이터도 함께 반환
};

const searchResult = await this.client.search(this.collectionName, searchParams);
```

**검색 결과 예시**:
```json
[
  {
    "id": "doc_abc123_chunk_001",
    "content": "2024년 프로젝트 총 예산은 5억원으로 책정되었으며...",
    "score": 0.89,
    "metadata": {
      "source": "프로젝트계획서.pdf",
      "page": 5,
      "chunk_id": "doc_abc123_chunk_001"
    }
  },
  {
    "id": "doc_def456_chunk_003", 
    "content": "예산 배분은 개발비 60%, 인건비 30%, 기타 10%로...",
    "score": 0.82,
    "metadata": {
      "source": "예산계획.xlsx",
      "page": 1
    }
  }
]
```

#### 4단계: 컨텍스트 준비
**위치**: `src/routes/chat.ts` - `prepareContext()` 함수

```typescript
function prepareContext(history: ChatMessage[], searchResults: any[]) {
  // 최근 대화 히스토리 (최대 6개 메시지)
  const recentHistory = history.slice(-6);
  
  // 검색된 문서들의 내용 결합
  const documents = searchResults
    .map(result => result.content)
    .join('\n\n');
  
  return {
    conversation_history: recentHistory,
    relevant_documents: documents,
    search_results: searchResults
  };
}
```

**결합된 컨텍스트 예시**:
```
relevant_documents: 
"2024년 프로젝트 총 예산은 5억원으로 책정되었으며...

예산 배분은 개발비 60%, 인건비 30%, 기타 10%로..."

conversation_history: 
[이전 대화 내용들...]
```

#### 5단계: AI 응답 생성 (Generation)
**위치**: `src/routes/chat.ts` - `generateResponse()` 함수

**5-1. 시스템 프롬프트 구성**
```typescript
const systemPrompt = `당신은 도움이 되는 AI 어시스턴트입니다. 제공된 문서를 기반으로 사용자의 질문에 정확하고 유용한 답변을 제공하세요.

다음은 관련 문서 내용입니다:
${context.relevant_documents}

답변 시 다음 사항을 준수하세요:
1. 제공된 문서 내용을 기반으로 답변하세요
2. 문서에 없는 내용은 추측하지 말고 솔직히 모른다고 하세요
3. 가능한 한 구체적이고 도움이 되는 답변을 제공하세요
4. 한국어로 자연스럽게 답변하세요`;
```

**5-2. 메시지 구성 및 AI 호출**
```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  ...recentHistory,  // 최근 대화 히스토리
  { role: 'user', content: query }  // 현재 질문
];

// GenerationService를 통해 AI 응답 생성
const generationResult = await generationService.generateResponse(messages, {
  max_tokens: 1000,
  temperature: 0.7,
  model: 'auto'  // 사용 가능한 첫 번째 모델 자동 선택
});
```

**5-3. 멀티 LLM 처리**
**위치**: `src/services/GenerationService.ts`

```typescript
// 사용 가능한 프로바이더 확인 후 자동 선택
const availableProviders = ['google', 'openai', 'anthropic', 'cohere'];
const selectedProvider = this.availableProviders[0]; // 첫 번째 사용 가능한 것

switch (selectedProvider) {
  case 'google':
    result = await this.generateWithGoogle(messages, model, options);
    break;
  case 'openai':
    result = await this.generateWithOpenAI(messages, model, options);
    break;
  // ... 기타 프로바이더
}
```

**AI 응답 예시**:
```json
{
  "content": "프로젝트 예산에 대해 문서를 확인한 결과, 2024년 프로젝트 총 예산은 5억원으로 책정되어 있습니다.\n\n예산 배분은 다음과 같습니다:\n- 개발비: 60% (3억원)\n- 인건비: 30% (1.5억원)\n- 기타: 10% (5천만원)\n\n자세한 내용은 프로젝트계획서.pdf 5페이지에서 확인하실 수 있습니다.",
  "model": "gemini-2.0-flash-exp",
  "tokens_used": 156,
  "provider": "google",
  "processing_time": 1240
}
```

#### 6단계: 응답 저장 및 반환
**위치**: `src/routes/chat.ts` - 응답 처리 로직

```typescript
// AI 응답을 세션 히스토리에 추가
const assistantMessage = {
  role: 'assistant',
  content: aiResponse.content,
  timestamp: new Date().toISOString(),
  metadata: {
    model: aiResponse.model,
    tokens_used: aiResponse.tokens_used,
    sources: searchResults.length
  }
};

session.history.push(assistantMessage);

// 히스토리 제한 (최근 10개 메시지만 유지)
if (session.history.length > 10) {
  session.history = session.history.slice(-10);
}

// 최종 응답 구성
const response = {
  answer: aiResponse.content,
  session_id: sessionId,
  sources: searchResults,
  tokens_used: aiResponse.tokens_used,
  processing_time: Date.now() - startTime,
  model_used: aiResponse.model
};
```

## 📊 전체 처리 시간 분석

**평균 처리 시간 (예시)**:
- 입력 검증 및 세션 처리: 5ms
- 벡터 검색 (임베딩 생성 + 검색): 200-500ms
- 컨텍스트 준비: 5ms
- AI 응답 생성: 800-2000ms
- 응답 저장 및 반환: 10ms

**총 처리 시간**: 약 1-3초

## 🔄 에러 처리 및 폴백

### 벡터 검색 실패 시
```typescript
if (!vectorService.isAvailable()) {
  logger.warn('Vector service not available, returning empty results');
  return []; // 빈 검색 결과로 진행
}
```

### AI 서비스 실패 시
```typescript
catch (error) {
  logger.logError(error, 'AI response generation failed');
  
  return {
    content: '죄송합니다. 현재 AI 서비스에 문제가 있어 답변을 생성할 수 없습니다.',
    model: 'fallback',
    tokens_used: 0,
    provider: 'system'
  };
}
```

## 🎯 RAG 시스템의 핵심 가치

### 1. 정확성
- 실제 업로드된 문서를 기반으로 답변
- 환상(hallucination) 방지

### 2. 맥락 이해
- 대화 히스토리 유지
- 이전 질문과 연관된 답변 가능

### 3. 확장성
- 새로운 문서 추가 시 즉시 반영
- 멀티 LLM 지원으로 안정성 확보

### 4. 투명성
- 답변 근거 (source) 제공
- 사용한 모델과 토큰 수 추적

이 RAG 시스템은 사용자의 질문을 정확하고 신뢰할 수 있는 방식으로 처리하여, 업로드된 문서를 기반으로 한 맞춤형 답변을 제공합니다.