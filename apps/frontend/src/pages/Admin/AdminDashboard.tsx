/**
 * 관리자 대시보드 메인 페이지
 * 프로덕션 운영을 위한 모니터링, 통계, 관리 기능 제공
 * 향상된 기능: 실시간 모니터링, 세션 관리, WebSocket 지원
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Snackbar,
  Pagination,
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as TestIcon,
  Delete as DeleteIcon,
  CloudDownload as CloudDownloadIcon,
  Build as BuildIcon,
  Visibility as ViewIcon,
  Group as SessionsIcon,
  Description as DocumentsIcon,
  Analytics as AnalyticsIcon,
  Dashboard as OverviewIcon,
  Settings as SettingsIcon,
  Psychology as PromptIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminService } from '../../services/adminService';
import PromptManager from '../../components/PromptManager';

interface SystemStatus {
  timestamp: string;
  services: {
    qdrant: { status: string; message: string; responseTime?: string };
    dynamodb: { status: string; message: string; responseTime?: string };
    llm: { status: string; message: string; responseTime?: string };
  };
}

interface Metrics {
  period: string;
  totalSessions: number;
  totalQueries: number;
  avgResponseTime: number;
  timeSeries: Array<{
    date: string;
    sessions: number;
    queries: number;
    avgResponseTime: number;
  }>;
}

interface KeywordData {
  keywords: Array<{
    rank: number;
    keyword: string;
    count: number;
  }>;
}

interface ChunkData {
  chunks: Array<{
    rank: number;
    chunkName: string;
    count: number;
  }>;
}

interface CountryData {
  countries: Array<{
    country: string;
    count: number;
  }>;
}

interface ChatLog {
  id: string;
  chatId: string;
  message: string;
  timestamp: string;
  responseTime: number;
  source: string;
  status: string;
  keywords: string[];
  country: string;
}

interface Document {
  name: string;
  chunkCount: number;
  size: string;
  lastUpdate: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface Session {
  id: string;
  status: 'active' | 'idle' | 'expired';
  lastActivity: string;
  messageCount: number;
  created: string;
  userAgent?: string;
  ipAddress?: string;
}

interface RealtimeMetrics {
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdminDashboard: React.FC = () => {
  // 다크모드 상태
  const [darkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  // 탭 관리
  const [currentTab, setCurrentTab] = useState(0);
  
  // Sendbird 테마 생성
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#742DDD', // Sendbird Purple 300
        light: '#C2A9FA', // Sendbird Purple 200
        dark: '#6210CC', // Sendbird Purple 400
      },
      secondary: {
        main: '#259C72', // Sendbird Teal 300
        light: '#69C085', // Sendbird Teal 200
        dark: '#027D69', // Sendbird Teal 400
      },
      background: {
        default: darkMode ? '#0D0D0D' : '#F7F7F7',
        paper: darkMode ? '#161616' : '#FFFFFF',
      },
      text: {
        primary: darkMode ? '#F7F7F7' : '#0D0D0D',
        secondary: darkMode ? '#C7C7C7' : '#585858',
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            border: '1px solid',
            borderColor: darkMode ? '#3B3B3B' : '#E9E9E9',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: 'translateY(-1px)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          },
          contained: {
            background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)',
            boxShadow: '0 2px 8px rgba(116, 45, 221, 0.3)',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(116, 45, 221, 0.4)',
            },
          },
        },
      },
    },
  });
  
  // 기존 State 관리
  const [loading, setLoading] = useState(true);
  const [, setSystemStatus] = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [keywords, setKeywords] = useState<KeywordData | null>(null);
  const [chunks, setChunks] = useState<ChunkData | null>(null);
  const [countries, setCountries] = useState<CountryData | null>(null);
  const [recentChats, setRecentChats] = useState<ChatLog[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [period] = useState('7d');
  
  // 새로운 state 변수들
  const [sessions, setSessions] = useState<Session[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  // const [connectedUsers] = useState(0);
  
  // 다이얼로그 상태
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  
  // 새로운 다이얼로그 상태들
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false);
  const [documentDetailOpen, setDocumentDetailOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  
  // 페이지네이션
  const [sessionsPage, setSessionsPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  const sessionsPerPage = 10;
  const documentsPerPage = 10;
  
  // 알림
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info' as 'success' | 'error' | 'warning' | 'info'
  });

  // 기능 수정 중 팝업 상태
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);

  // 데이터 로딩 함수들
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        statusData,
        metricsData,
        keywordsData,
        chunksData,
        countriesData,
        chatsData,
        documentsData,
        sessionsData,
        realtimeData
      ] = await Promise.all([
        adminService.getSystemStatus(),
        adminService.getMetrics(period),
        adminService.getKeywordAnalysis(period),
        adminService.getChunkAnalysis(period),
        adminService.getCountryAnalysis(period),
        adminService.getRecentChats(20),
        adminService.getDocuments(),
        adminService.getSessions({ status: 'all', limit: 50, offset: 0 }),
        adminService.getRealtimeMetrics()
      ]);

      setSystemStatus(statusData);
      setMetrics(metricsData);
      setKeywords(keywordsData);
      setChunks(chunksData);
      setCountries(countriesData);
      setRecentChats(chatsData.chats);
      setDocuments(documentsData.documents);
      setSessions(sessionsData.sessions);
      setRealtimeMetrics(realtimeData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showSnackbar('대시보드 데이터 로딩 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  // WebSocket 초기화 및 이벤트 리스너
  useEffect(() => {
    adminService.initWebSocket();

    // 실시간 메트릭 업데이트
    adminService.on('realtime-metrics', (data: RealtimeMetrics) => {
      setRealtimeMetrics(data);
    });

    // 연결 상태 업데이트
    adminService.on('connection', (data: { connected: boolean }) => {
      if (data.connected) {
        showSnackbar('실시간 모니터링 연결됨', 'success');
      } else {
        showSnackbar('실시간 모니터링 연결 끊김', 'warning');
      }
    });

    // 새 세션 알림
    adminService.on('new-session', (session: Session) => {
      setSessions(prev => [session, ...prev]);
      showSnackbar(`새 세션 생성: ${session.id}`, 'info');
    });

    // 세션 업데이트
    adminService.on('session-updated', (session: Session) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s));
    });

    // 컴포넌트 언마운트 시 정리
    return () => {
      adminService.disconnectWebSocket();
    };
  }, []);

  // 알림 표시 함수
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    loadDashboardData();
  }, [period, loadDashboardData]);

  // 컴포넌트 마운트 시 기능 수정 중 팝업 표시
  useEffect(() => {
    setMaintenanceDialogOpen(true);
  }, []);

  // 개발자 도구로 돌아가기
  const handleBackToDeveloperTools = () => {
    setMaintenanceDialogOpen(false);
    window.location.href = '/';
  };

  // 테스트 실행
  const handleTest = async () => {
    if (!testQuery.trim()) return;
    
    setTestLoading(true);
    try {
      const result = await adminService.testRAG(testQuery);
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({ error: 'Test execution failed' });
    } finally {
      setTestLoading(false);
    }
  };

  // 시스템 작업
  const handleRebuildIndex = async () => {
    if (window.confirm('전체 인덱스를 재구축하시겠습니까? 이 작업은 시간이 오래 걸릴 수 있습니다.')) {
      try {
        await adminService.rebuildIndex();
        alert('인덱스 재구축이 시작되었습니다.');
      } catch {
        alert('인덱스 재구축 실패');
      }
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const blob = await adminService.downloadLogs();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rag-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSnackbar('로그 다운로드 완료', 'success');
    } catch {
      showSnackbar('로그 다운로드 실패', 'error');
    }
  };

  // 새로운 이벤트 핸들러들
  const handleSessionView = async (sessionId: string) => {
    try {
      const sessionDetails = await adminService.getSessionDetails(sessionId);
      setSelectedSession(sessionDetails);
      setSessionDetailOpen(true);
    } catch {
      showSnackbar('세션 정보 로딩 실패', 'error');
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    if (window.confirm('이 세션을 삭제하시겠습니까?')) {
      try {
        await adminService.deleteSession(sessionId);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        showSnackbar('세션이 삭제되었습니다', 'success');
      } catch {
        showSnackbar('세션 삭제 실패', 'error');
      }
    }
  };

  const handleDocumentView = (document: Document) => {
    setSelectedDocument(document);
    setDocumentDetailOpen(true);
  };

  const handleDocumentDelete = async (documentName: string) => {
    if (window.confirm('이 문서를 삭제하시겠습니까?')) {
      try {
        await adminService.deleteDocument(documentName);
        setDocuments(prev => prev.filter(d => d.name !== documentName));
        showSnackbar('문서가 삭제되었습니다', 'success');
      } catch {
        showSnackbar('문서 삭제 실패', 'error');
      }
    }
  };

  const handleDocumentReprocess = async (documentName: string) => {
    try {
      await adminService.reprocessDocument(documentName);
      showSnackbar('문서 재처리가 시작되었습니다', 'success');
    } catch {
      showSnackbar('문서 재처리 실패', 'error');
    }
  };

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'healthy': return 'success';
  //     case 'error': return 'error';
  //     default: return 'warning';
  //   }
  // };

  // const getStatusIcon = (status: string) => {
  //   return status === 'healthy' ? '●' : status === 'error' ? '●' : '●';
  // };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
        {/* Sendbird 스타일 헤더 */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)',
            borderRadius: 0,
            boxShadow: '0 2px 8px rgba(116, 45, 221, 0.15)'
          }}
        >
          <Toolbar sx={{ minHeight: '64px', px: 3 }}>
            <Typography 
              variant="h2" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontSize: '20px',
                fontWeight: 600,
                color: 'white',
                letterSpacing: '-0.01em'
              }}
            >
              RAG Pipe - 관리자 대시보드
            </Typography>
            <Button
              color="inherit"
              onClick={() => window.location.href = '/'}
              sx={{ 
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                }
              }}
            >
              개발자 도구로 돌아가기
            </Button>
          </Toolbar>
        </AppBar>
        {/* 탭 네비게이션 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            {/* 실시간 상태 표시 */}
            {realtimeMetrics && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip 
                  label={`활성 연결: ${realtimeMetrics.activeConnections}`} 
                  size="small" 
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: '6px'
                  }}
                />
                <Chip 
                  label={`응답시간: ${realtimeMetrics.averageResponseTime}ms`} 
                  size="small" 
                  sx={{
                    bgcolor: realtimeMetrics.averageResponseTime > 1000 ? '#FFC107' : '#259C72',
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: '6px'
                  }}
                />
              </Box>
            )}
            
            <IconButton 
              onClick={loadDashboardData}
              sx={{
                borderRadius: '8px',
                bgcolor: 'rgba(116, 45, 221, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(116, 45, 221, 0.2)',
                }
              }}
            >
              <RefreshIcon sx={{ color: 'primary.main' }} />
            </IconButton>
          </Box>

          {/* 탭 네비게이션 */}
          <Tabs 
            value={currentTab} 
            onChange={(event, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTab-root': {
                minHeight: '48px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s ease',
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'rgba(116, 45, 221, 0.08)'
                },
                '&.Mui-selected': {
                  fontWeight: 600,
                  color: 'primary.main'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            <Tab icon={<OverviewIcon sx={{ fontSize: '20px' }} />} label="개요" iconPosition="start" />
            <Tab icon={<SessionsIcon sx={{ fontSize: '20px' }} />} label="세션" iconPosition="start" />
            <Tab icon={<DocumentsIcon sx={{ fontSize: '20px' }} />} label="문서" iconPosition="start" />
            <Tab icon={<AnalyticsIcon sx={{ fontSize: '20px' }} />} label="성능" iconPosition="start" />
            <Tab icon={<PromptIcon sx={{ fontSize: '20px' }} />} label="프롬프트" iconPosition="start" />
            <Tab icon={<SettingsIcon sx={{ fontSize: '20px' }} />} label="설정" iconPosition="start" />
          </Tabs>
      </Box>

        {/* 탭 컨텐츠 */}
        {/* 개요 탭 */}
        <TabPanel value={currentTab} index={0}>
        {/* 메트릭 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  총 세션
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 2 }}>
                  {metrics?.totalSessions?.toLocaleString() || 0}
                </Typography>
                <Box sx={{ height: 60, backgroundColor: '#f8f9fa', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.timeSeries || []}>
                      <Line type="monotone" dataKey="sessions" stroke="#0066cc" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  총 쿼리
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 2 }}>
                  {metrics?.totalQueries?.toLocaleString() || 0}
                </Typography>
                <Box sx={{ height: 60, backgroundColor: '#f8f9fa', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.timeSeries || []}>
                      <Line type="monotone" dataKey="queries" stroke="#28a745" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  평균 응답시간
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 2 }}>
                  {metrics?.avgResponseTime?.toFixed(1) || 0}s
                </Typography>
                <Box sx={{ height: 60, backgroundColor: '#f8f9fa', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.timeSeries || []}>
                      <Line type="monotone" dataKey="avgResponseTime" stroke="#ffc107" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  활성 연결
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 2 }}>
                  {realtimeMetrics?.activeConnections || 0}
                </Typography>
                <Box sx={{ height: 60, backgroundColor: '#f8f9fa', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    실시간 모니터링
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 분석 및 통계 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  주요 문의 키워드 TOP 5
                </Typography>
                {keywords?.keywords?.map((item) => (
                  <Box key={item.rank} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid #e9ecef' }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      backgroundColor: '#e9ecef', 
                      borderRadius: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      mr: 1.5
                    }}>
                      {item.rank}
                    </Box>
                    <Typography sx={{ flexGrow: 1 }}>
                      {item.keyword}
                    </Typography>
                    <Typography color="textSecondary" sx={{ fontWeight: 500 }}>
                      {item.count}회
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  자주 선택된 청크 TOP 5
                </Typography>
                {chunks?.chunks?.map((item) => (
                  <Box key={item.rank} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid #e9ecef' }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      backgroundColor: '#e9ecef', 
                      borderRadius: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      mr: 1.5
                    }}>
                      {item.rank}
                    </Box>
                    <Typography sx={{ flexGrow: 1, fontSize: 14 }}>
                      {item.chunkName}
                    </Typography>
                    <Typography color="textSecondary" sx={{ fontWeight: 500 }}>
                      {item.count}회
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 최근 활동 */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            {/* 최근 쿼리 */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    최근 쿼리
                  </Typography>
                  <Button size="small">전체보기</Button>
                </Box>
                
                {recentChats.slice(0, 5).map((chat) => (
                  <Box key={chat.id} sx={{ p: 2, backgroundColor: '#fafbfc', borderRadius: 1, mb: 1.5, border: '1px solid #e9ecef' }}>
                    <Typography sx={{ mb: 1, fontWeight: 500 }}>
                      "{chat.message}"
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, fontSize: 12, color: 'text.secondary' }}>
                      <span>{new Date(chat.timestamp).toLocaleString()}</span>
                      <span>응답시간: {chat.responseTime}ms</span>
                      <span>소스: {chat.source}</span>
                      <Chip 
                        label={chat.status === 'success' ? '성공' : '오류'} 
                        size="small" 
                        color={chat.status === 'success' ? 'success' : 'error'}
                      />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            {/* 접속 국가 */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  접속 국가
                </Typography>
                <Grid container spacing={2}>
                  {countries?.countries?.slice(0, 8).map((country) => (
                    <Grid item xs={6} key={country.country}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                        <Typography variant="body2">
                          {country.country}
                        </Typography>  
                        <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                          {country.count}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* 빠른 테스트 */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  빠른 테스트
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<TestIcon />}
                  fullWidth
                  onClick={() => setTestDialogOpen(true)}
                >
                  테스트 실행
                </Button>
              </CardContent>
            </Card>

            {/* 시스템 작업 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  시스템 작업
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<BuildIcon />}
                    fullWidth
                    onClick={handleRebuildIndex}
                  >
                    전체 인덱스 재구축
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    fullWidth
                  >
                    캐시 초기화
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownloadIcon />}
                    fullWidth
                    onClick={handleDownloadLogs}
                  >
                    로그 다운로드
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

        {/* 세션 탭 */}
        <TabPanel value={currentTab} index={1}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                활성 세션 ({sessions.length})
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>상태 필터</InputLabel>
                <Select defaultValue="all" label="상태 필터">
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="active">활성</MenuItem>
                  <MenuItem value="idle">대기</MenuItem>
                  <MenuItem value="expired">만료</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>세션 ID</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>메시지 수</TableCell>
                    <TableCell>생성 시간</TableCell>
                    <TableCell>마지막 활동</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.slice((sessionsPage - 1) * sessionsPerPage, sessionsPage * sessionsPerPage).map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{session.id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={session.status}
                          color={
                            session.status === 'active' ? 'success' :
                            session.status === 'idle' ? 'warning' : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{session.messageCount}</TableCell>
                      <TableCell>{new Date(session.created).toLocaleString()}</TableCell>
                      <TableCell>{new Date(session.lastActivity).toLocaleString()}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleSessionView(session.id)}>
                          <ViewIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleSessionDelete(session.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination 
                count={Math.ceil(sessions.length / sessionsPerPage)} 
                page={sessionsPage}
                onChange={(event, value) => setSessionsPage(value)}
              />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

        {/* 문서 탭 */}
        <TabPanel value={currentTab} index={2}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                문서 관리 ({documents.length})
              </Typography>
              <Button variant="contained" size="small">
                문서 추가
              </Button>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>문서명</TableCell>
                    <TableCell>청크 수</TableCell>
                    <TableCell>크기</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>업데이트</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.slice((documentsPage - 1) * documentsPerPage, documentsPage * documentsPerPage).map((doc) => (
                    <TableRow key={doc.name}>
                      <TableCell>{doc.name}</TableCell>
                      <TableCell>{doc.chunkCount}</TableCell>
                      <TableCell>{doc.size}</TableCell>
                      <TableCell>
                        <Chip 
                          label={doc.status || 'active'}
                          color={doc.status === 'processing' ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{doc.lastUpdate}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleDocumentView(doc)}>
                          <ViewIcon />
                        </IconButton>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => handleDocumentReprocess(doc.name)}
                          sx={{ mx: 1 }}
                        >
                          재처리
                        </Button>
                        <IconButton size="small" onClick={() => handleDocumentDelete(doc.name)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination 
                count={Math.ceil(documents.length / documentsPerPage)} 
                page={documentsPage}
                onChange={(event, value) => setDocumentsPage(value)}
              />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>


        {/* 성능 탭 */}
        <TabPanel value={currentTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  실시간 성능 메트릭
                </Typography>
                {realtimeMetrics && (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        요청/초
                      </Typography>
                      <Typography variant="h4">
                        {realtimeMetrics.requestsPerSecond}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        오류율
                      </Typography>
                      <Typography variant="h4" color={realtimeMetrics.errorRate > 5 ? 'error' : 'primary'}>
                        {realtimeMetrics.errorRate}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        메모리 사용량
                      </Typography>
                      <Typography variant="h4">
                        {realtimeMetrics.memoryUsage}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        CPU 사용량
                      </Typography>
                      <Typography variant="h4">
                        {realtimeMetrics.cpuUsage}%
                      </Typography>
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  응답 시간 분포
                </Typography>
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.timeSeries || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="avgResponseTime" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

        {/* 프롬프트 관리 탭 */}
        <TabPanel value={currentTab} index={4}>
          <PromptManager />
        </TabPanel>

        {/* 설정 탭 */}
        <TabPanel value={currentTab} index={5}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  시스템 작업
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<BuildIcon />}
                    fullWidth
                    onClick={handleRebuildIndex}
                  >
                    전체 인덱스 재구축
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    fullWidth
                  >
                    캐시 초기화
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownloadIcon />}
                    fullWidth
                    onClick={handleDownloadLogs}
                  >
                    로그 다운로드
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  빠른 테스트
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<TestIcon />}
                  fullWidth
                  onClick={() => setTestDialogOpen(true)}
                >
                  테스트 실행
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

        {/* 테스트 다이얼로그 */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>빠른 테스트</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="테스트할 질문을 입력하세요"
            placeholder="예: What is the MOQ for brake pads?"
            fullWidth
            variant="outlined"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          {testResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                테스트 결과
              </Typography>
              
              {testResult.error ? (
                <Alert severity="error">{testResult.error}</Alert>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    검색된 청크:
                  </Typography>
                  <Box sx={{ mb: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                    {testResult.retrievedChunks?.map((chunk: Record<string, unknown>, index: number) => (
                      <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                        {chunk.content} (점수: {chunk.score?.toFixed(3)})
                      </Typography>
                    ))}
                  </Box>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    생성된 답변:
                  </Typography>
                  <Box sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {testResult.generatedAnswer}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    응답시간: {testResult.responseTime}
                  </Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>
            닫기
          </Button>
          <Button 
            onClick={handleTest} 
            variant="contained"
            disabled={testLoading || !testQuery.trim()}
          >
            {testLoading ? <CircularProgress size={20} /> : '테스트 실행'}
          </Button>
        </DialogActions>
      </Dialog>

        {/* 세션 상세 다이얼로그 */}
      <Dialog open={sessionDetailOpen} onClose={() => setSessionDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>세션 상세 정보</DialogTitle>
        <DialogContent>
          {selectedSession && (
            <Box>
              <Typography variant="h6" gutterBottom>세션 ID: {selectedSession.id}</Typography>
              <Typography>상태: {selectedSession.status}</Typography>
              <Typography>메시지 수: {selectedSession.messageCount}</Typography>
              <Typography>생성 시간: {new Date(selectedSession.created).toLocaleString()}</Typography>
              <Typography>마지막 활동: {new Date(selectedSession.lastActivity).toLocaleString()}</Typography>
              {selectedSession.userAgent && (
                <Typography>User Agent: {selectedSession.userAgent}</Typography>
              )}
              {selectedSession.ipAddress && (
                <Typography>IP 주소: {selectedSession.ipAddress}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionDetailOpen(false)}>닫기</Button>
          {selectedSession && (
            <Button 
              onClick={() => handleSessionDelete(selectedSession.id)} 
              color="error"
            >
              세션 삭제
            </Button>
          )}
        </DialogActions>
      </Dialog>

        {/* 문서 상세 다이얼로그 */}
      <Dialog open={documentDetailOpen} onClose={() => setDocumentDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>문서 상세 정보</DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <Box>
              <Typography variant="h6" gutterBottom>문서명: {selectedDocument.name}</Typography>
              <Typography>청크 수: {selectedDocument.chunkCount}</Typography>
              <Typography>크기: {selectedDocument.size}</Typography>
              <Typography>상태: {selectedDocument.status || 'active'}</Typography>
              <Typography>마지막 업데이트: {selectedDocument.lastUpdate}</Typography>
              {selectedDocument.metadata && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">메타데이터:</Typography>
                  <pre>{JSON.stringify(selectedDocument.metadata, null, 2)}</pre>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocumentDetailOpen(false)}>닫기</Button>
          {selectedDocument && (
            <>
              <Button 
                onClick={() => handleDocumentReprocess(selectedDocument.name)}
                variant="outlined"
              >
                재처리
              </Button>
              <Button 
                onClick={() => handleDocumentDelete(selectedDocument.name)} 
                color="error"
              >
                문서 삭제
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* 기능 수정 중 팝업 */}
      <Dialog 
        open={maintenanceDialogOpen}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 2,
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          pb: 1,
          color: '#742DDD',
          fontWeight: 600
        }}>
          🔧 기능 수정 중입니다
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            관리자 대시보드 기능을 개선 중입니다.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            더 나은 서비스를 위해 잠시 기다려 주세요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            onClick={handleBackToDeveloperTools}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)',
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(116, 45, 221, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(116, 45, 221, 0.4)',
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            개발자 도구로 돌아가기
          </Button>
        </DialogActions>
      </Dialog>

        {/* 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default AdminDashboard;