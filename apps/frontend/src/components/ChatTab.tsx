import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Card,
  CardContent,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Send,
  Person,
  ExpandMore,
  Source,
  Refresh,
  Info,
  History,
  Code,
  ExpandLess,
  Visibility,
  VisibilityOff,
  Settings,
  BugReport,
  BarChart,
} from '@mui/icons-material';
import { ChatMessage, ToastMessage } from '../types';
import { chatAPI } from '../services/api';

// 귀여운 챗봇 아이콘 SVG 컴포넌트
const CuteChatbotIcon = ({ fontSize = '24px', color = '#742DDD' }: { fontSize?: string; color?: string }) => (
  <svg 
    width={fontSize} 
    height={fontSize} 
    viewBox="0 0 48 48" 
    fill="none" 
    style={{ display: 'inline-block' }}
  >
    {/* 머리 */}
    <circle cx="24" cy="22" r="16" fill={color} opacity="0.9"/>
    {/* 얼굴 */}
    <circle cx="24" cy="22" r="13" fill="#FFFFFF"/>
    {/* 귀 (안테나) */}
    <circle cx="16" cy="12" r="2" fill={color}/>
    <circle cx="32" cy="12" r="2" fill={color}/>
    <line x1="16" y1="12" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="32" y1="12" x2="32" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    {/* 눈 */}
    <circle cx="19" cy="20" r="2" fill="#333"/>
    <circle cx="29" cy="20" r="2" fill="#333"/>
    {/* 눈 반짝임 */}
    <circle cx="19.5" cy="19.5" r="0.5" fill="#FFF"/>
    <circle cx="29.5" cy="19.5" r="0.5" fill="#FFF"/>
    {/* 입 */}
    <path d="M20 26 Q24 29 28 26" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    {/* 볼 */}
    <circle cx="14" cy="24" r="1.5" fill="#FFB3BA" opacity="0.6"/>
    <circle cx="34" cy="24" r="1.5" fill="#FFB3BA" opacity="0.6"/>
    {/* 몸체 */}
    <rect x="18" y="35" width="12" height="8" rx="2" fill={color} opacity="0.8"/>
    {/* 팔 */}
    <circle cx="12" cy="38" r="2" fill={color} opacity="0.7"/>
    <circle cx="36" cy="38" r="2" fill={color} opacity="0.7"/>
  </svg>
);

interface ChatTabProps {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

interface ApiLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response';
  method: string;
  endpoint: string;
  data: unknown;
  status?: number;
  duration?: number;
}

export const ChatTab: React.FC<ChatTabProps> = ({ showToast }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionInfo, setSessionInfo] = useState<Record<string, unknown> | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [isDebugExpanded, setIsDebugExpanded] = useState<boolean>(false);
  const [messageAnimations, setMessageAnimations] = useState<Set<string>>(new Set());
  // 반응형: 화면 크기에 따라 개발자 도구 초기 상태 설정
  const [showDevTools, setShowDevTools] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // lg 사이즈 이상에서만 기본 표시
    }
    return true;
  });

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, []);

  // 🔧 세션 동기화 유틸리티 함수
  const synchronizeSessionId = useCallback((newSessionId: string, context: string = '') => {
    if (newSessionId && newSessionId !== sessionId) {
      console.log(`🔄 세션 동기화 (${context}):`, {
        from: sessionId,
        to: newSessionId,
        context
      });
      
      setSessionId(newSessionId);
      localStorage.setItem('chatSessionId', newSessionId);
      
      // 동기화 알림은 중요한 경우에만 표시
      if (context.includes('불일치') || context.includes('복구')) {
        showToast({
          type: 'info',
          message: `세션이 동기화되었습니다. (${context})`,
        });
      }
      
      return true; // 동기화 발생
    }
    return false; // 동기화 불필요
  }, [sessionId, showToast]);


  // 세션 초기화 함수 - useEffect보다 먼저 정의
  const initializeSession = useCallback(async () => {
    try {
      const storedSessionId = localStorage.getItem('chatSessionId');
      if (storedSessionId) {
        console.log('🔄 저장된 세션 ID로 초기화:', storedSessionId);
        setSessionId(storedSessionId);
        
        // 기존 채팅 기록 로드
        try {
          const response = await chatAPI.getChatHistory(storedSessionId);
          
          // 📍 채팅 기록 로드 시에도 세션 ID 동기화 확인
          if (response.data.messages.length > 0) {
            const lastMessage = response.data.messages[response.data.messages.length - 1];
            const historySessionId = lastMessage.session_id;
            
            synchronizeSessionId(historySessionId, '기록 로드 시 불일치');
          }
          
          setMessages(response.data.messages.map((msg, index) => ({
            id: index.toString(),
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: msg.response || msg.answer,
            timestamp: new Date().toISOString(),
            sources: msg.sources,
          })));
        } catch (historyError) {
          console.warn('채팅 기록을 불러올 수 없습니다:', historyError);
          // 기록을 불러올 수 없으면 세션 유효성 검증
          console.log('📝 세션 유효성 검증을 위해 새 세션 생성');
          
          const newSessionResponse = await chatAPI.startNewSession();
          const validSessionId = newSessionResponse.data.session_id;
          setSessionId(validSessionId);
          localStorage.setItem('chatSessionId', validSessionId);
          
          showToast({
            type: 'info',
            message: '새로운 세션으로 시작합니다.',
          });
        }
      } else {
        console.log('🆕 새 세션 생성');
        const response = await chatAPI.startNewSession();
        const newSessionId = response.data.session_id;
        setSessionId(newSessionId);
        localStorage.setItem('chatSessionId', newSessionId);
        
        console.log('✅ 새 세션 생성 완료:', newSessionId);
      }
    } catch (error) {
      console.error('세션 초기화 실패:', error);
      showToast({
        type: 'error',
        message: '세션 초기화에 실패했습니다.',
      });
      
      // 🔧 실패 시 fallback: 임시 세션 ID 생성
      const fallbackSessionId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆘 Fallback 세션 ID 생성:', fallbackSessionId);
      synchronizeSessionId(fallbackSessionId, '세션 초기화 실패 복구');
    }
  }, [showToast, synchronizeSessionId]);

  // 세션 초기화
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // 메시지 스크롤 및 애니메이션 (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
      // 모든 메시지에 애니메이션 적용 (초기 로드 시)
      const allMessageIds = new Set(messages.map(msg => msg.id));
      setMessageAnimations(allMessageIds);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // API 요청 로그
    const requestLog: ApiLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'request',
      method: 'POST',
      endpoint: '/api/chat',
      data: {
        message: input,
        session_id: sessionId,
      },
    };
    setApiLogs((prev) => [...prev, requestLog]);

    const startTime = Date.now();

    try {
      const response = await chatAPI.sendMessage(input, sessionId);
      
      // 🔄 세션 ID 동기화 - 백엔드 응답의 session_id로 프론트엔드 상태 업데이트
      const backendSessionId = response.data.session_id;
      const wasSynchronized = synchronizeSessionId(backendSessionId, '메시지 응답 불일치 감지');
      
      // API 응답 로그
      const responseLog: ApiLog = {
        id: (Date.now() + 1).toString(),
        timestamp: new Date().toISOString(),
        type: 'response',
        method: 'POST',
        endpoint: '/api/chat',
        data: response.data,
        status: 200,
        duration: Date.now() - startTime,
      };
      setApiLogs((prev) => [...prev, responseLog]);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toISOString(),
        sources: response.data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // 세션 정보 업데이트 (최신 동기화된 session_id 사용)
      const currentSessionId = backendSessionId || sessionId;
      console.log('API Response:', response.data);
      console.log('Model Info:', response.data.model_info);
      console.log('세션 동기화 결과:', { 
        wasSynchronized,
        currentSessionId,
        messageCount: messages.length + 2
      });
      
      const newSessionInfo = {
        sessionId: currentSessionId, // 동기화된 최신 세션 ID 사용
        tokensUsed: response.data.tokens_used,
        processingTime: response.data.processing_time,
        messageCount: messages.length + 2,
        modelInfo: response.data.model_info,
        // Debug용 추가 정보
        provider: response.data.model_info?.provider,
        model: response.data.model_info?.model,
        generationTime: response.data.model_info?.generation_time,
        parameters: response.data.model_info?.model_config,
        // 동기화 상태 추가
        lastSynchronized: wasSynchronized ? new Date().toISOString() : undefined
      };
      
      console.log('Setting sessionInfo:', newSessionInfo);
      setSessionInfo(newSessionInfo);
    } catch (error: unknown) {
      console.error('메시지 전송 오류:', error);
      const apiError = error as { response?: { data?: { message?: string }; status?: number }; message?: string };
      
      // API 에러 로그
      const errorLog: ApiLog = {
        id: (Date.now() + 2).toString(),
        timestamp: new Date().toISOString(),
        type: 'response',
        method: 'POST',
        endpoint: '/api/chat',
        data: apiError?.response?.data || { error: apiError?.message || 'Unknown error' },
        status: apiError?.response?.status || 0,
        duration: Date.now() - startTime,
      };
      setApiLogs((prev) => [...prev, errorLog]);
      
      const errorMessage = apiError?.response?.data?.message || '메시지 전송에 실패했습니다.';
      
      showToast({
        type: 'error',
        message: errorMessage,
      });
      
      // 에러 메시지 추가
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = async () => {
    try {
      console.log('🆕 새 세션 시작 요청');
      const response = await chatAPI.startNewSession();
      const newSessionId = response.data.session_id;
      
      // 🔄 새 세션 생성 시 상태 및 저장소 완전 동기화
      console.log('✅ 새 세션 ID 생성:', newSessionId);
      synchronizeSessionId(newSessionId, '새 세션 생성');
      setMessages([]);
      
      // 세션 정보도 초기화
      setSessionInfo(null);
      
      showToast({
        type: 'success',
        message: '새로운 대화를 시작합니다.',
      });
      
      console.log('🎯 새 세션 초기화 완료:', {
        sessionId: newSessionId,
        messagesCleared: true,
        localStorageUpdated: true
      });
    } catch (error) {
      console.error('새 세션 시작 실패:', error);
      showToast({
        type: 'error',
        message: '새 세션 시작에 실패했습니다.',
      });
      
      // 🔧 실패 시 fallback 세션 생성
      const fallbackSessionId = `new-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆘 새 세션 Fallback ID 생성:', fallbackSessionId);
      synchronizeSessionId(fallbackSessionId, '새 세션 생성 실패 복구');
      setMessages([]);
      setSessionInfo(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <Box sx={{ 
      height: '80vh', // 전체 높이를 70vh에서 80vh로 증가 
      display: 'flex',
      bgcolor: '#F2F2F7', // iOS background secondary
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      {/* 왼쪽 사이드바: 개발자 도구 패널 */}
      {showDevTools && (
        <Box sx={{
          width: '320px',
          minWidth: '320px',
          height: '100%',
          bgcolor: 'white',
          borderRight: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
        }}>
          {/* 헤더 */}
          <Box sx={{ 
            p: 2.5, 
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'linear-gradient(to bottom, #fafafa, #fff)'
          }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center">
                <Settings sx={{ mr: 1.5, fontSize: '20px', color: '#007AFF' }} /> {/* iOS icon medium, iOS blue */}
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    fontSize: '17px', // iOS headline
                    letterSpacing: '-0.011em',
                    color: '#000000' // iOS label primary
                  }}
                >개발자 도구</Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={() => setShowDevTools(false)}
                title="개발자 도구 닫기"
                sx={{
                  transition: '0.15s ease-out', // iOS transition fast
                  borderRadius: '10px', // iOS radius medium
                  '&:hover': {
                    bgcolor: 'rgba(0, 122, 255, 0.1)', // iOS blue with opacity
                    transform: 'scale(1.02)' // Subtle iOS-style scale
                  }
                }}
              >
                <VisibilityOff fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          {/* 탭 네비게이션 */}
          <Tabs 
            value={leftPanelTab} 
            onChange={(_, newValue) => setLeftPanelTab(newValue)}
            variant="fullWidth"
            sx={{ 
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
              '& .MuiTab-root': { 
                minHeight: '44px', // iOS touch target
                fontSize: '15px', // iOS subheadline
                fontWeight: 400,
                transition: '0.15s ease-out', // iOS transition fast
                borderRadius: '10px', // iOS radius medium
                margin: '4px',
                color: '#3C3C43', // iOS label secondary
                '&:hover': {
                  bgcolor: 'rgba(0, 122, 255, 0.1)' // iOS blue with opacity
                },
                '&.Mui-selected': {
                  fontWeight: 600,
                  color: '#007AFF', // iOS blue
                  bgcolor: '#FFFFFF' // iOS background primary
                }
              }
            }}
          >
            <Tab icon={<Info sx={{ fontSize: '1rem' }} />} label="세션 정보" iconPosition="start" />
            <Tab icon={<History sx={{ fontSize: '1rem' }} />} label="API 로그" iconPosition="start" />
          </Tabs>
          
          {/* 스크롤 컨텐츠 영역 */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
            {leftPanelTab === 0 ? (
              /* 세션 정보 탭 */
              <Box sx={{ p: 2 }}>
                {/* 현재 세션 카드 */}
                <Card variant="outlined" sx={{ 
                  mb: 2, 
                  borderRadius: '8px', 
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: 2,
                    transform: 'translateY(-1px)'
                  }
                }}>
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <Code sx={{ mr: 1, fontSize: '1.1rem', color: 'primary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        현재 세션
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'JetBrains Mono, monospace', 
                      bgcolor: 'rgba(0,0,0,0.04)', 
                      p: 1.5, 
                      borderRadius: 1.5,
                      fontSize: '0.85rem',
                      letterSpacing: '0.05em'
                    }}>
                      {sessionId || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
                
                {sessionInfo && (
                  <>
                    {/* 통계 정보 카드 */}
                    <Card variant="outlined" sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid rgba(0,0,0,0.08)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
                      }
                    }}>
                      <CardContent sx={{ pb: '16px !important' }}>
                        <Box display="flex" alignItems="center" mb={1.5}>
                          <BarChart sx={{ mr: 1, fontSize: '1.1rem', color: 'success.main' }} />
                          <Typography variant="subtitle2" fontWeight={600}>
                            세션 통계
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              💬 메시지
                            </Typography>
                            <Chip label={sessionInfo.messageCount} size="small" sx={{ height: 20, fontWeight: 600 }} />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              🎯 토큰
                            </Typography>
                            <Chip label={sessionInfo.tokensUsed} size="small" color="primary" sx={{ height: 20, fontWeight: 600 }} />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              ⚡ 처리시간
                            </Typography>
                            <Chip label={`${sessionInfo.processingTime?.toFixed(2)}s`} size="small" color="success" sx={{ height: 20, fontWeight: 600 }} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>

                    {sessionInfo?.modelInfo && (
                      <>
                        {/* LLM 모델 정보 카드 */}
                        <Card variant="outlined" sx={{ mb: 2 }}>
                          <CardContent sx={{ pb: '16px !important' }}>
                            <Box display="flex" alignItems="center" mb={1}>
                              <CuteChatbotIcon fontSize="16px" color="#ff6b6b" />
                              <Typography variant="subtitle2" fontWeight={600}>
                                LLM 모델 정보
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'grid', gap: 0.5 }}>
                              <Typography variant="body2" color="text.secondary">
                                🏢 프로바이더: <strong>{sessionInfo.modelInfo.provider || 'N/A'}</strong>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                🤖 모델: <strong>{sessionInfo.modelInfo.model || 'N/A'}</strong>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                ⏱️ 생성시간: <strong>{sessionInfo.modelInfo.generation_time ? `${sessionInfo.modelInfo.generation_time.toFixed(3)}s` : 'N/A'}</strong>
                              </Typography>
                          
                              {sessionInfo.modelInfo.model_config && (
                                <>
                                  <Divider sx={{ my: 1 }} />
                                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                                    📊 모델 파라미터
                                  </Typography>
                                  <Box sx={{ display: 'grid', gap: 0.25 }}>
                                    {sessionInfo.modelInfo.model_config.temperature !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        🌡️ Temperature: <strong>{sessionInfo.modelInfo.model_config.temperature}</strong>
                                      </Typography>
                                    )}
                                    {(sessionInfo.modelInfo.model_config.max_tokens || sessionInfo.modelInfo.model_config.max_output_tokens) && (
                                      <Typography variant="caption" color="text.secondary">
                                        📏 Max Tokens: <strong>{sessionInfo.modelInfo.model_config.max_tokens || sessionInfo.modelInfo.model_config.max_output_tokens}</strong>
                                      </Typography>
                                    )}
                                    {sessionInfo.modelInfo.model_config.top_p !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        🎯 Top P: <strong>{sessionInfo.modelInfo.model_config.top_p}</strong>
                                      </Typography>
                                    )}
                                    {sessionInfo.modelInfo.model_config.top_k !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        🔝 Top K: <strong>{sessionInfo.modelInfo.model_config.top_k}</strong>
                                      </Typography>
                                    )}
                                  </Box>
                                </>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    
                    {/* 디버그 정보 카드 - 접기/펼치기 기능 */}
                    {process.env.NODE_ENV === 'development' && sessionInfo && (
                      <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                          <Box 
                            onClick={() => setIsDebugExpanded(!isDebugExpanded)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              p: 0.5,
                              borderRadius: 1,
                              '&:hover': { bgcolor: 'grey.50' }
                            }}
                          >
                            <BugReport sx={{ mr: 1, fontSize: '1rem', color: 'warning.main' }} />
                            <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
                              Debug 정보
                            </Typography>
                            {isDebugExpanded ? <ExpandLess /> : <ExpandMore />}
                          </Box>
                          
                          {isDebugExpanded && (
                            <Box sx={{ 
                              mt: 1,
                              bgcolor: 'grey.50', 
                              p: 1, 
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              border: '1px solid',
                              borderColor: 'grey.200'
                            }}>
                              <Typography variant="caption" component="pre" sx={{ fontSize: 'inherit' }}>
                                {JSON.stringify({
                                  sessionId: sessionInfo.sessionId,
                                  tokensUsed: sessionInfo.tokensUsed,
                                  processingTime: sessionInfo.processingTime,
                                  messageCount: sessionInfo.messageCount,
                                  provider: sessionInfo.provider,
                                  model: sessionInfo.model,
                                  generationTime: sessionInfo.generationTime,
                                  parameters: sessionInfo.parameters
                                }, null, 2)}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
                
                {/* 새 세션 시작 버튼 */}
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={handleNewSession}
                  size="medium"
                  sx={{ 
                    background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)',
                    boxShadow: '0 2px 8px rgba(116, 45, 221, 0.3)',
                    borderRadius: '8px',
                    py: 1.2,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                      background: 'linear-gradient(135deg, #6210CC 0%, #491389 100%)',
                      boxShadow: '0 4px 12px rgba(116, 45, 221, 0.4)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  새 세션 시작
                </Button>
              </Box>
            ) : (
              /* API 로그 탭 */
              <Box sx={{ p: 2 }}>
                {apiLogs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <History sx={{ fontSize: '3rem', color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      API 호출 내역이 없습니다.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {apiLogs.slice().reverse().map((log) => (
                      <Card key={log.id} variant="outlined" sx={{ mb: 1 }}>
                      <Box
                        onClick={() => toggleLogExpansion(log.id)}
                        sx={{
                          cursor: 'pointer',
                          p: 1,
                          borderRadius: 1,
                          bgcolor: log.type === 'request' ? 'primary.50' : log.status === 200 ? 'success.50' : 'error.50',
                          '&:hover': { bgcolor: log.type === 'request' ? 'primary.100' : log.status === 200 ? 'success.100' : 'error.100' },
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight="bold">
                            {log.method} {log.endpoint}
                          </Typography>
                          <Chip
                            label={log.type === 'request' ? 'REQ' : `RES ${log.status}`}
                            size="small"
                            color={log.type === 'request' ? 'primary' : log.status === 200 ? 'success' : 'error'}
                            sx={{ height: 20 }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(log.timestamp).toLocaleTimeString('ko-KR')}
                          {log.duration && ` (${log.duration}ms)`}
                        </Typography>
                      </Box>
                        {expandedLogs.has(log.id) && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" component="pre" sx={{ overflow: 'auto', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                              {JSON.stringify(log.data, null, 2)}
                            </Typography>
                          </Box>
                        )}
                        </Card>
                      ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}
      
      {/* 메인 콘텐츠 영역 - 채팅 화면 */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'stretch', 
        p: 3,
        minHeight: '80vh' // minHeight를 70vh에서 80vh로 증가
      }}>
        <Box sx={{ 
          width: '100%', 
          maxWidth: '820px', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderRadius: '12px',
          boxShadow: 3,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider'
        }}>
          {/* 헤더 */}
          <Box sx={{ 
            p: 3, 
            background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)', // Sendbird purple gradient
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" position="relative" zIndex={1}>
              <Box display="flex" alignItems="center">
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '14px', // iOS radius large
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  mr: 2,
                  backdropFilter: 'blur(20px) saturate(180%)' // iOS blur light
                }}>
                  <CuteChatbotIcon fontSize="24px" /> {/* iOS icon large */}
                </Box>
                <Box>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700,
                      fontSize: '22px', // iOS title 2
                      letterSpacing: '-0.022em',
                      lineHeight: 1.2
                    }}
                  >
                    RAG 챗봇
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      opacity: 0.9,
                      fontSize: '15px', // iOS subheadline
                      fontWeight: 400
                    }}
                  >
                    지능형 대화 시스템
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" gap={1.5} alignItems="center">
                <Chip 
                  label={`세션: ${sessionId.slice(0, 8)}...`} 
                  size="small" 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                  icon={<Code />}
                />
                {!showDevTools && (
                  <IconButton 
                    size="medium" 
                    onClick={() => setShowDevTools(true)}
                    title="개발자 도구 보기"
                    sx={{ 
                      color: 'white', 
                      bgcolor: 'rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s',
                      '&:hover': { 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        transform: 'scale(1.05)'
                      } 
                    }}
                  >
                    <Visibility />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Box>

          {/* 채팅 메시지 영역 */}
          <Box sx={{ 
            flexGrow: 1,
            minHeight: '500px', // 최소 높이 설정
            maxHeight: '800px', // 최대 높이 800px로 설정
            overflow: 'auto', 
            p: 3,
            bgcolor: 'background.default',
            position: 'relative',
            '&::-webkit-scrollbar': {
              width: '6px' // Thinner iOS-style scrollbar
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '3px',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }}>
            <List sx={{ p: 0 }}>
          {messages.map((message) => (
            <React.Fragment key={message.id}>
              <ListItem
                sx={{
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  gap: 2,
                  alignItems: 'flex-start',
                  opacity: messageAnimations.has(message.id) ? 1 : 0,
                  transform: messageAnimations.has(message.id) ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  mb: 2
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                    color: message.role === 'user' ? 'white' : 'primary.main',
                    border: message.role === 'user' ? 'none' : 1,
                    borderColor: message.role === 'user' ? 'transparent' : 'divider',
                    boxShadow: 1,
                    width: 32,
                    height: 32,
                    fontSize: '16px'
                  }}
                >
                  {message.role === 'user' ? <Person sx={{ fontSize: '16px' }} /> : <CuteChatbotIcon fontSize="16px" />}
                </Avatar>
                <Box
                  sx={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      px: 2.5,
                      background: message.role === 'user' 
                        ? 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)' // Sendbird purple gradient
                        : 'background.paper',
                      color: message.role === 'user' ? 'white' : 'text.primary',
                      borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      boxShadow: message.role === 'user' 
                        ? '0 2px 8px rgba(116, 45, 221, 0.3)' // Purple shadow
                        : 1,
                      border: message.role === 'user' ? 'none' : 1,
                      borderColor: message.role === 'user' ? 'transparent' : 'divider',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: message.role === 'user' 
                          ? '0 4px 12px rgba(116, 45, 221, 0.4)'
                          : 2
                      }
                    }}
                    elevation={0}
                  >
                    <Typography variant="body1" sx={{ 
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      fontSize: '14px',
                      fontWeight: 400
                    }}>
                      {message.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 1,
                        opacity: message.role === 'user' ? 0.8 : 0.6,
                        fontSize: '12px',
                        fontWeight: 400,
                        lineHeight: 1.4
                      }}
                    >
                      {formatTimestamp(message.timestamp)}
                    </Typography>
                  </Paper>

                  {/* 소스 표시 */}
                  {message.sources && message.sources.length > 0 && (
                    <Accordion sx={{
                      mt: 1,
                      borderRadius: '8px',
                      boxShadow: 1,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      '&:before': { display: 'none' },
                      '&.Mui-expanded': {
                        margin: '8px 0',
                        boxShadow: 2
                      }
                    }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Source sx={{ mr: 1 }} />
                        <Typography variant="body2">
                          참조 문서 ({message.sources.length}개)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {message.sources.map((source, idx) => (
                            <React.Fragment key={idx}>
                              <ListItem>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" fontWeight="bold">
                                      {source.document} {source.chunk && `(청크 #${source.chunk})`}
                                    </Typography>
                                  }
                                  secondary={
                                    <>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 1, fontStyle: 'italic' }}
                                      >
                                        "{source.content_preview.substring(0, 200)}..."
                                      </Typography>
                                      <Chip
                                        label={`유사도: ${(source.relevance * 100).toFixed(1)}%`}
                                        size="small"
                                        sx={{ mt: 1 }}
                                        color="primary"
                                        variant="outlined"
                                      />
                                    </>
                                  }
                                />
                              </ListItem>
                              {idx < (message.sources?.length || 0) - 1 && <Divider />}
                            </React.Fragment>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              </ListItem>
            </React.Fragment>
          ))}

          {/* 로딩 인디케이터 */}
          {loading && (
            <ListItem sx={{
              animation: 'fadeIn 0.5s ease-in-out',
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' }
              }
            }}>
              <Avatar sx={{ 
                bgcolor: 'background.paper',
                color: 'primary.main',
                border: 1,
                borderColor: 'divider',
                boxShadow: 1,
                width: 40,
                height: 40
              }}>
                <CuteChatbotIcon fontSize="20px" />
              </Avatar>
              <Box sx={{ 
                ml: 2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                bgcolor: 'background.default',
                px: 2.5,
                py: 1.5,
                borderRadius: '8px',
                border: 1,
                borderColor: 'divider'
              }}>
                <CircularProgress size={18} thickness={5} sx={{ color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={400}>
                  AI가 답변을 생성하고 있습니다...
                </Typography>
              </Box>
            </ListItem>
          )}
              <div ref={messagesEndRef} />
            </List>
          </Box>

          {/* 입력 영역 */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'background.paper', 
            borderTop: 1,
            borderColor: 'divider'
          }}>
            <Box display="flex" gap={2} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="메시지를 입력하세요..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: 'background.default',
                    border: '1.5px solid transparent',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    '&:hover': {
                      borderColor: 'rgba(116, 45, 221, 0.2)'
                    },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      borderColor: 'primary.main',
                      boxShadow: '0 0 0 3px rgba(116, 45, 221, 0.1)'
                    },
                    '& fieldset': {
                      border: 'none'
                    }
                  },
                  '& .MuiInputBase-input': {
                    px: 2.5,
                    py: 1.5,
                    fontWeight: 400
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                size="large"
                sx={{ 
                  background: !input.trim() || loading 
                    ? '#C7C7C7' 
                    : 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)',
                  color: 'white',
                  boxShadow: !input.trim() || loading 
                    ? 'none' 
                    : '0 2px 8px rgba(116, 45, 221, 0.3)',
                  borderRadius: '8px',
                  width: 48,
                  height: 48,
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    background: !input.trim() || loading 
                      ? '#C7C7C7' 
                      : 'linear-gradient(135deg, #6210CC 0%, #491389 100%)',
                    boxShadow: !input.trim() || loading 
                      ? 'none' 
                      : '0 4px 12px rgba(116, 45, 221, 0.4)',
                    transform: !input.trim() || loading ? 'none' : 'translateY(-1px)'
                  },
                  '&:active': {
                    transform: 'translateY(0)'
                  },
                  '&:disabled': { 
                    background: '#C7C7C7',
                    boxShadow: 'none'
                  }
                }}
              >
                <Send sx={{ fontSize: '20px' }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
