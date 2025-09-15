import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '@/utils/logger';
import { ChatRequest, ChatResponse, ChatMessage, ConversationSession } from '@/types';
import { vectorService } from '@/services/VectorService';
import { generationService } from '@/services/GenerationService';

const router = express.Router();
const logger = getLogger('ChatRoute');

// 세션 저장소 (실제로는 Redis나 Database 사용)
const sessions = new Map<string, ConversationSession>();

// 채팅 메시지 처리 엔드포인트
router.post('/', async (req, res): Promise<void> => {
  try {
    const { message, session_id, max_tokens = 1000, temperature = 0.7 }: ChatRequest = req.body;

    // 입력 검증
    if (!message || message.trim().length === 0) {
      res.error('Message is required', 'EMPTY_MESSAGE', 400);
      return;
    }

    if (message.length > 4000) {
      res.error('Message too long (max: 4000 characters)', 'MESSAGE_TOO_LONG', 400);
      return;
    }

    // 세션 처리
    const sessionId = session_id || uuidv4();
    let session = sessions.get(sessionId);

    if (!session) {
      session = {
        session_id: sessionId,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        message_count: 0,
        history: [],
      };
      sessions.set(sessionId, session);
      logger.info('New chat session created', { sessionId });
    }

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    session.history.push(userMessage);
    session.last_activity = new Date().toISOString();
    session.message_count++;

    logger.info('User message received', {
      sessionId,
      messageLength: message.length,
      messageCount: session.message_count,
    });

    // RAG 파이프라인 실행
    const startTime = Date.now();
    
    try {
      // 1. 벡터 검색 (TODO: 실제 구현)
      const searchResults = await performVectorSearch(message);
      
      // 2. 컨텍스트 준비
      const context = prepareContext(session.history, searchResults);
      
      // 3. LLM 응답 생성 (TODO: 실제 구현)
      const aiResponse = await generateResponse(message, context, {
        max_tokens,
        temperature,
      });

      // 4. 응답 메시지 추가
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date().toISOString(),
        metadata: {
          model: aiResponse.model,
          tokens_used: aiResponse.tokens_used,
          sources: searchResults.length,
        },
      };

      session.history.push(assistantMessage);
      session.last_activity = new Date().toISOString();

      // 히스토리 제한 (최근 10개 메시지만 유지)
      if (session.history.length > 10) {
        session.history = session.history.slice(-10);
      }

      sessions.set(sessionId, session);

      const processingTime = Date.now() - startTime;

      logger.info('Chat response generated', {
        sessionId,
        processingTime: `${processingTime}ms`,
        model: aiResponse.model,
        tokensUsed: aiResponse.tokens_used,
        sourcesFound: searchResults.length,
      });

      const response: ChatResponse = {
        answer: aiResponse.content,
        session_id: sessionId,
        sources: searchResults,
        tokens_used: aiResponse.tokens_used,
        processing_time: processingTime,
        model_used: aiResponse.model,
      };

      res.success(response);

    } catch (aiError) {
      logger.logError(aiError as Error, 'AI processing failed', { sessionId, message });
      
      // 에러 시에도 세션은 유지하되 에러 응답만 반환
      res.error(
        'I apologize, but I encountered an issue processing your request. Please try again.',
        'AI_PROCESSING_ERROR',
        503,
        { sessionId, canRetry: true }
      );
    }

  } catch (error) {
    logger.logError(error as Error, 'Chat endpoint error');
    res.error('Failed to process chat message', 'CHAT_ERROR', 500);
  }
});

// 채팅 히스토리 조회 엔드포인트
router.get('/history/:sessionId', (req, res): void => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      res.error('Session not found', 'SESSION_NOT_FOUND', 404);
      return;
    }

    const response = {
      session_id: sessionId,
      messages: session.history,
      message_count: session.message_count,
      created_at: session.created_at,
      last_activity: session.last_activity,
    };

    res.success(response);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get chat history');
    res.error('Failed to retrieve chat history', 'HISTORY_ERROR', 500);
  }
});

// 새 세션 시작 엔드포인트
router.post('/session', (req, res) => {
  try {
    const sessionId = uuidv4();
    
    const session: ConversationSession = {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      message_count: 0,
      history: [],
    };

    sessions.set(sessionId, session);

    logger.info('New chat session created manually', { sessionId });

    res.success({
      session_id: sessionId,
      message: 'New session created successfully',
    });

  } catch (error) {
    logger.logError(error as Error, 'Failed to create new session');
    res.error('Failed to create new session', 'SESSION_ERROR', 500);
  }
});

// 세션 삭제 엔드포인트
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (sessions.has(sessionId)) {
      sessions.delete(sessionId);
      logger.info('Chat session deleted', { sessionId });
      res.success({ message: 'Session deleted successfully' });
    } else {
      res.error('Session not found', 'SESSION_NOT_FOUND', 404);
    }

  } catch (error) {
    logger.logError(error as Error, 'Failed to delete session');
    res.error('Failed to delete session', 'DELETE_SESSION_ERROR', 500);
  }
});

// 벡터 검색 함수 - 실제 Qdrant 연결
async function performVectorSearch(query: string) {
  try {
    if (!vectorService.isAvailable()) {
      logger.warn('Vector service not available, returning empty results');
      return [];
    }

    const searchResults = await vectorService.search(query, {
      limit: 5,
      threshold: 0.7,
    });

    logger.info('Vector search completed', {
      query: query.substring(0, 100),
      resultsFound: searchResults.length,
    });

    return searchResults.map(result => ({
      content: result.content,
      metadata: {
        source: result.metadata.source || 'unknown',
        page: result.metadata.page || 1,
        chunk_id: result.metadata.chunk_id || result.id,
        score: result.score,
      },
    }));

  } catch (error) {
    logger.logError(error as Error, 'Vector search failed', { query });
    
    // 벡터 검색 실패 시 빈 결과 반환
    return [];
  }
}

// 컨텍스트 준비 함수
function prepareContext(history: ChatMessage[], searchResults: any[]) {
  // 최근 대화 히스토리
  const recentHistory = history.slice(-6); // 최근 3턴의 대화
  
  // 검색된 문서 내용
  const documents = searchResults.map(result => result.content).join('\n\n');
  
  return {
    conversation_history: recentHistory,
    relevant_documents: documents,
    search_results: searchResults,
  };
}

// LLM 응답 생성 함수 - 실제 멀티-LLM 시스템 연결
async function generateResponse(query: string, context: any, options: any) {
  try {
    if (!generationService.getAvailableProviders().length) {
      throw new Error('No AI providers available');
    }

    // 시스템 프롬프트 구성
    const systemPrompt = `당신은 도움이 되는 AI 어시스턴트입니다. 제공된 문서를 기반으로 사용자의 질문에 정확하고 유용한 답변을 제공하세요.

다음은 관련 문서 내용입니다:
${context.relevant_documents || '관련 문서를 찾을 수 없습니다.'}

답변 시 다음 사항을 준수하세요:
1. 제공된 문서 내용을 기반으로 답변하세요
2. 문서에 없는 내용은 추측하지 말고 솔직히 모른다고 하세요
3. 가능한 한 구체적이고 도움이 되는 답변을 제공하세요
4. 한국어로 자연스럽게 답변하세요`;

    // 대화 히스토리를 포함한 메시지 구성
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // 최근 대화 히스토리 추가 (최대 3턴)
    const recentHistory = context.conversation_history.slice(-6);
    messages.push(...recentHistory);

    // 현재 사용자 질문 추가
    messages.push({ role: 'user', content: query });

    // AI 응답 생성
    const generationResult = await generationService.generateResponse(messages, {
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.7,
      model: 'auto', // 자동으로 사용 가능한 첫 번째 모델 선택
    });

    logger.info('AI response generated successfully', {
      provider: generationResult.provider,
      model: generationResult.model,
      tokensUsed: generationResult.tokens_used,
      contentLength: generationResult.content.length,
    });

    return {
      content: generationResult.content,
      model: generationResult.model,
      tokens_used: generationResult.tokens_used,
      provider: generationResult.provider,
    };

  } catch (error) {
    logger.logError(error as Error, 'AI response generation failed', { query });
    
    // AI 생성 실패 시 기본 응답
    return {
      content: '죄송합니다. 현재 AI 서비스에 문제가 있어 답변을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.',
      model: 'fallback',
      tokens_used: 0,
      provider: 'system',
    };
  }
}

// 세션 정리 함수 (주기적 실행)
function cleanupExpiredSessions() {
  const now = Date.now();
  const maxAge = 3600000; // 1시간

  for (const [sessionId, session] of sessions.entries()) {
    const lastActivity = new Date(session.last_activity).getTime();
    
    if (now - lastActivity > maxAge) {
      sessions.delete(sessionId);
      logger.info('Expired session cleaned up', { sessionId, age: now - lastActivity });
    }
  }
}

// 5분마다 세션 정리 실행
setInterval(cleanupExpiredSessions, 300000);

export default router;