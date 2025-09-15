import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Alert,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Speed,
  CheckCircle,
  Memory,
  Refresh,
  AccessTime,
  CloudCircle,
  NetworkCheck,
  BugReport,
  ExpandMore,
  Api,
  Code,
  Timeline,
  DataUsage,
  Computer,
  Dns,
} from '@mui/icons-material';
import { healthAPI, statsAPI } from '../services/api';

// 타입 정의
interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

interface StatsData {
  uptime: number;
  uptime_human: string;
  cpu_percent: number;
  memory_usage: {
    total: number;
    available: number;
    used: number;
    percentage: number;
    total_gb: number;
    used_gb: number;
    available_gb: number;
  };
  disk_usage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  system_info: {
    platform: string;
    python_version: string;
    cpu_count: number;
    boot_time: string;
  };
}

interface CombinedStatus {
  health: HealthStatus;
  stats: StatsData;
}

interface ApiCallLog {
  timestamp: string;
  endpoint: string;
  data: unknown;
  error: string | null;
  status: 'success' | 'error';
}

export const StatsTab: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<CombinedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [apiCalls, setApiCalls] = useState<Record<string, ApiCallLog>>({});
  const [error, setError] = useState<string | null>(null);

  // API 호출 로거 
  const logApiCall = useCallback((endpoint: string, data: unknown, error?: Error) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      endpoint,
      data: error ? null : data,
      error: error?.message || null,
      status: error ? 'error' : 'success'
    };
    
    setApiCalls(prev => ({
      ...prev,
      [endpoint]: logEntry
    }));
  }, []);

  const fetchSystemStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 시스템 통계 데이터 로딩 중...');
      
      // Health 상태와 Stats 데이터 동시 조회
      const [healthResponse, statsResponse] = await Promise.all([
        healthAPI.check(),
        statsAPI.getStats()
      ]);
      
      const combinedData = {
        health: healthResponse.data,
        stats: statsResponse.data
      };
      
      logApiCall('/health', healthResponse.data);
      logApiCall('/stats', statsResponse.data);
      setSystemStatus(combinedData);
      
      console.log('✅ 시스템 상태 데이터 로드 완료:', statusData);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 통계 데이터 로딩 실패:', err);
      logApiCall('/stats', null, err instanceof Error ? err : new Error(String(err)));
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [logApiCall]);

  useEffect(() => {
    fetchSystemStats();
    
    // 30초마다 자동 갱신
    const interval = setInterval(fetchSystemStats, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemStats]);


  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'active':
      case 'running':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: '1400px', mx: 'auto' }}>
      {/* 헤더 */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={4}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 3,
          p: 3,
          color: 'white'
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="600" gutterBottom>
            🔧 시스템 통계
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            실시간 시스템 상태 및 성능 모니터링
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch 
                checked={debugMode} 
                onChange={(e) => setDebugMode(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'white',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <BugReport />
                <Typography variant="body2">디버그 모드</Typography>
              </Box>
            }
            sx={{ color: 'white' }}
          />
          
          <Tooltip title="새로고침">
            <IconButton 
              onClick={fetchSystemStats} 
              disabled={loading}
              sx={{ 
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 에러 알림 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress sx={{ borderRadius: 1 }} />
        </Box>
      )}

      {/* 시스템 상태 카드들 */}
      {systemStatus && (
        <>
          {/* 상태 개요 */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={0}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.15)'
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'success.light',
                        color: 'success.dark'
                      }}
                    >
                      <CheckCircle fontSize="large" />
                    </Box>
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        시스템 상태
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h5" fontWeight="600">
                          {systemStatus.health.status}
                        </Typography>
                        <Chip 
                          label={systemStatus.health.status}
                          color={getStatusColor(systemStatus.health.status)}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={0}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(118, 75, 162, 0.15)'
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'info.light',
                        color: 'info.dark'
                      }}
                    >
                      <AccessTime fontSize="large" />
                    </Box>
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        가동시간
                      </Typography>
                      <Typography variant="h5" fontWeight="600">
                        {systemStatus.stats.uptime_human}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={0}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(255, 152, 0, 0.15)'
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'warning.light',
                        color: 'warning.dark'
                      }}
                    >
                      <Memory fontSize="large" />
                    </Box>
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        메모리 사용량
                      </Typography>
                      <Typography variant="h5" fontWeight="600">
                        {systemStatus.stats.memory_usage.used_gb.toFixed(1)} GB
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        사용률: {systemStatus.stats.memory_usage.percentage.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                elevation={0}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(76, 175, 80, 0.15)'
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'primary.light',
                        color: 'primary.dark'
                      }}
                    >
                      <Speed fontSize="large" />
                    </Box>
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        CPU 사용률
                      </Typography>
                      <Typography variant="h5" fontWeight="600">
                        {systemStatus.stats.cpu_percent.toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        코어: {systemStatus.stats.system_info.cpu_count}개
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 시스템 정보 */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              mb: 4, 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Computer color="primary" />
              시스템 정보
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    플랫폼
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {systemStatus.stats.system_info.platform}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    Python 버전
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {systemStatus.stats.system_info.python_version}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    환경
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {systemStatus.health.environment}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    버전
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {systemStatus.health.version}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* 디스크 사용량 */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              mb: 4, 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline color="primary" />
              디스크 사용량
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    전체 용량
                  </Typography>
                  <Typography variant="h4" color="primary" fontWeight="600">
                    {systemStatus.stats.disk_usage.total_gb.toFixed(0)} GB
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    사용된 용량
                  </Typography>
                  <Typography variant="h4" color="warning.main" fontWeight="600">
                    {systemStatus.stats.disk_usage.used_gb.toFixed(0)} GB
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    사용률
                  </Typography>
                  <Typography variant="h4" color="info.main" fontWeight="600">
                    {systemStatus.stats.disk_usage.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}

      {/* 디버그 정보 */}
      <Collapse in={debugMode}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 3, 
            border: '1px solid',
            borderColor: 'warning.light',
            borderRadius: 3,
            bgcolor: 'warning.50'
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReport color="warning" />
            디버그 정보
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Api />
                API 호출 로그
                <Badge badgeContent={Object.keys(apiCalls).length} color="primary" />
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {Object.entries(apiCalls).map(([endpoint, log]) => (
                  <ListItem key={endpoint}>
                    <ListItemIcon>
                      <Chip 
                        label={log.status}
                        color={log.status === 'success' ? 'success' : 'error'}
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={endpoint}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            시간: {new Date(log.timestamp).toLocaleTimeString()}
                          </Typography>
                          {log.error && (
                            <Typography variant="caption" color="error" display="block">
                              오류: {log.error}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Code />
                시스템 로그
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                {systemStatus && (
                  <pre>
                    {JSON.stringify(systemStatus, null, 2)}
                  </pre>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NetworkCheck />
                연결 정보
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><Dns /></ListItemIcon>
                  <ListItemText
                    primary="API Base URL"
                    secondary="https://simple-rag-production-bb72.up.railway.app"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><DataUsage /></ListItemIcon>
                  <ListItemText
                    primary="WebSocket URL"
                    secondary="wss://simple-rag-production-bb72.up.railway.app"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CloudCircle /></ListItemIcon>
                  <ListItemText
                    primary="환경"
                    secondary={import.meta.env.DEV ? 'Development' : 'Production'}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Collapse>
    </Box>
  );
};