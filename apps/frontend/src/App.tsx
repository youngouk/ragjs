import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  Button,
} from '@mui/material';
import ChatPage from './pages/ChatPage';
import UploadPage from './pages/UploadPage';
import PromptsPage from './pages/PromptsPage';
import AnalysisPage from './pages/AnalysisPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';


// 메인 앱 컴포넌트 (라우팅 포함)
function App() {
  // Sendbird 테마 사용 (일관성을 위해)
  const theme = createTheme({
    palette: {
      primary: {
        main: '#742DDD', // Sendbird Purple 300
        light: '#C2A9FA', // Sendbird Purple 200
        dark: '#6210CC', // Sendbird Purple 400
      },
      secondary: {
        main: '#259C72', // Sendbird Teal 300
      },
      background: {
        default: '#F7F7F7', // Sendbird neutral
        paper: '#FFFFFF', // Sendbird paper
      },
      text: {
        primary: '#0D0D0D', // Sendbird text
        secondary: '#585858', // Sendbird secondary text
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      h4: {
        fontSize: '24px',
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
      button: {
        fontSize: '14px',
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 8, // Sendbird default radius
    },
    components: {
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* 기본 경로 - 챗봇으로 리다이렉트 */}
          <Route path="/" element={
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '100vh',
              flexDirection: 'column',
              gap: 2,
              bgcolor: '#F7F7F7'
            }}>
              <Typography variant="h4" color="primary" sx={{ mb: 2 }}>
                RAG Pipe
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                어떤 서비스를 이용하시겠습니까?
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => window.location.href = '/bot'}
                >
                  챗봇 사용하기
                </Button>
                <Button 
                  variant="outlined" 
                  size="large"
                  onClick={() => window.location.href = '/upload'}
                >
                  관리 도구
                </Button>
              </Box>
            </Box>
          } />
          
          {/* 새로운 라우팅 구조 */}
          <Route path="/bot" element={
            <ErrorBoundary>
              <ChatPage />
            </ErrorBoundary>
          } />
          
          <Route path="/upload" element={
            <ErrorBoundary>
              <UploadPage />
            </ErrorBoundary>
          } />
          
          <Route path="/prompts" element={
            <ErrorBoundary>
              <PromptsPage />
            </ErrorBoundary>
          } />
          
          <Route path="/analysis" element={
            <ErrorBoundary>
              <AnalysisPage />
            </ErrorBoundary>
          } />
          
          {/* 관리자 대시보드 */}
          <Route path="/admin" element={
            <ErrorBoundary>
              <AdminDashboard />
            </ErrorBoundary>
          } />
          
          {/* 404 페이지 */}
          <Route path="*" element={
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '50vh',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="h4" color="textSecondary">
                404 - 페이지를 찾을 수 없습니다
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => window.location.href = '/bot'}
              >
                챗봇으로 이동
              </Button>
            </Box>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App
