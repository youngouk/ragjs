import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Alert,
  Chip,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  CloudUpload,
  Description,
  Chat,
  BarChart,
  Psychology as PromptIcon,
  Logout,
} from '@mui/icons-material';
import { UploadTab } from '../components/UploadTab';
import { DocumentsTab } from '../components/DocumentsTab';
import ErrorBoundary from '../components/ErrorBoundary';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { removeAdminAccess } from '../utils/accessControl';
import { healthAPI } from '../services/api';
import { ToastMessage } from '../types';

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
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UploadPage() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [activeTab, setActiveTab] = useState(0);
  const [serverStatus, setServerStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 테마 생성 - Sendbird 스타일
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
      error: {
        main: '#BF0711', // Sendbird Error 300
        light: '#E53157', // Sendbird Error 200
        dark: '#A30E16', // Sendbird Error 400
      },
      warning: {
        main: '#FFC107', // Sendbird Warning 300
        light: '#FFF2B6', // Sendbird Warning 100
        dark: '#E89404', // Sendbird Warning 500
      },
      info: {
        main: '#3B7FFF', // Sendbird Info 300
        light: '#ADC9FF', // Sendbird Info 100
        dark: '#0062E0', // Sendbird Info 500
      },
      success: {
        main: '#259C72', // Sendbird Success 300
        light: '#A8E2AB', // Sendbird Success 100
        dark: '#066858', // Sendbird Success 500
      },
      background: {
        default: darkMode ? '#0D0D0D' : '#F7F7F7', // Sendbird neutral
        paper: darkMode ? '#161616' : '#FFFFFF', // Sendbird paper
      },
      text: {
        primary: darkMode ? '#F7F7F7' : '#0D0D0D', // Sendbird text
        secondary: darkMode ? '#C7C7C7' : '#585858', // Sendbird secondary text
      },
      divider: darkMode ? '#3B3B3B' : '#E9E9E9', // Sendbird divider
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontSize: '24px',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h2: {
        fontSize: '20px',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h6: {
        fontSize: '16px',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      body1: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: 1.5,
      },
      caption: {
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 1.4,
      },
      button: {
        fontSize: '14px',
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 8, // Sendbird default radius
    },
    shadows: [
      'none',
      '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      '0 2px 8px rgba(116, 45, 221, 0.3)', // Purple shadow
      '0 4px 12px rgba(116, 45, 221, 0.4)', // Purple shadow hover
      '0 4px 14px 0 rgba(116, 45, 221, 0.25)', // Purple shadow medium
      '0 4px 14px 0 rgba(37, 156, 114, 0.25)', // Teal shadow
      ...Array(15).fill('none'),
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 20px',
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
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              backgroundColor: 'rgba(116, 45, 221, 0.08)',
              borderWidth: '1.5px',
            },
          },
        },
      },
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
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: '6px',
            fontWeight: 500,
          },
        },
      },
    },
  });

  // 서버 상태 확인
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await healthAPI.check();
        setServerStatus(response.data.status === 'OK' ? 'healthy' : 'unhealthy');
      } catch {
        setServerStatus('unhealthy');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30초마다 확인

    return () => clearInterval(interval);
  }, []);

  // 다크모드 토글
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  // 토스트 메시지 표시
  const showToast = (message: Omit<ToastMessage, 'id'>) => {
    setToast({
      ...message,
      id: Date.now().toString(),
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleLogout = () => {
    removeAdminAccess();
    window.location.href = '/bot';
  };

  const handleMenuClick = (path: string) => {
    window.location.href = path;
  };

  return (
    <ProtectedRoute title="문서 관리 접근">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          flexGrow: 1,
          bgcolor: '#F2F2F7', // iOS background secondary
          minHeight: '100vh'
        }}>
          <AppBar 
            position="static" 
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #742DDD 0%, #6210CC 100%)', // Sendbird purple gradient
              borderRadius: 0,
              boxShadow: '0 2px 8px rgba(116, 45, 221, 0.15)' // Purple shadow
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
                RAG Pipe - 문서 관리
              </Typography>

              {/* 네비게이션 메뉴 */}
              <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
                <Button
                  color="inherit"
                  startIcon={<Chat sx={{ fontSize: '18px' }} />}
                  onClick={() => handleMenuClick('/bot')}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.2)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  챗봇
                </Button>
                <Button
                  color="inherit"
                  startIcon={<PromptIcon sx={{ fontSize: '18px' }} />}
                  onClick={() => handleMenuClick('/prompts')}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.2)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  프롬프트
                </Button>
                <Button
                  color="inherit"
                  startIcon={<BarChart sx={{ fontSize: '18px' }} />}
                  onClick={() => handleMenuClick('/analysis')}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.2)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  통계
                </Button>
              </Box>
              
              <Chip
                label={serverStatus === 'healthy' ? '정상' : serverStatus === 'checking' ? '확인중' : '오류'}
                color={serverStatus === 'healthy' ? 'success' : serverStatus === 'checking' ? 'default' : 'error'}
                size="small"
                sx={{ 
                  mr: 2,
                  borderRadius: '10px', // iOS radius medium
                  fontWeight: 600,
                  fontSize: '12px', // iOS caption
                  bgcolor: serverStatus === 'healthy' ? '#259C72' : serverStatus === 'checking' ? 'rgba(255,255,255,0.2)' : '#BF0711', // Sendbird semantic colors
                  color: 'white',
                  '&.MuiChip-colorDefault': {
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white'
                  }
                }}
              />
              
              <IconButton 
                onClick={handleLogout}
                color="inherit"
                title="로그아웃"
                sx={{
                  mr: 1,
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.15)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Logout sx={{ fontSize: '20px' }} />
              </IconButton>
              
              <IconButton 
                onClick={toggleDarkMode} 
                color="inherit"
                sx={{
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.15)',
                    transform: 'rotate(180deg)'
                  }
                }}
              >
                {darkMode ? <Brightness7 sx={{ fontSize: '20px' }} /> : <Brightness4 sx={{ fontSize: '20px' }} />}
              </IconButton>
            </Toolbar>
          </AppBar>

          <Container 
            maxWidth="xl"
            sx={{
              minHeight: 'calc(100vh - 64px)',
              pb: 3
            }}
          >
            <Box sx={{ 
              borderBottom: 1,
              borderColor: 'divider', 
              mt: 2,
              bgcolor: 'background.default'
            }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange} 
                aria-label="upload tabs"
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
                <Tab icon={<CloudUpload sx={{ fontSize: '20px' }} />} label="문서 업로드" iconPosition="start" />
                <Tab icon={<Description sx={{ fontSize: '20px' }} />} label="문서 관리" iconPosition="start" />
              </Tabs>
            </Box>

            <TabPanel value={activeTab} index={0}>
              <ErrorBoundary>
                <UploadTab showToast={showToast} />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <ErrorBoundary>
                <DocumentsTab showToast={showToast} />
              </ErrorBoundary>
            </TabPanel>
          </Container>
        </Box>

        <Snackbar
          open={!!toast}
          autoHideDuration={toast?.duration || 6000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => setToast(null)} 
            severity={toast?.type || 'info'} 
            sx={{ 
              width: '100%',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '14px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid',
              borderColor: toast?.type === 'error' ? 'error.main' : toast?.type === 'success' ? 'success.main' : 'primary.main'
            }}
          >
            {toast?.message || ''}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    </ProtectedRoute>
  );
}