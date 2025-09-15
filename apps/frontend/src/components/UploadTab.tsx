import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Collapse,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
  Error,
  Close,
  PlayArrow,
  ExpandMore,
  ExpandLess,
  Refresh,
} from '@mui/icons-material';
import { ToastMessage } from '../types';
import { documentAPI } from '../services/api';

interface UploadTabProps {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

interface UploadSettings {
  splitterType: 'recursive' | 'markdown' | 'semantic';
  chunkSize: number;
  chunkOverlap: number;
}

interface UploadFile {
  id: string;
  file: File;
  originalFileName?: string; // 원본 파일명 보존 (파일명 단축 시 사용)
  status: 'selected' | 'ready' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  documentId?: string;
  settings?: UploadSettings;
  processingDetails?: {
    processingTime: number;
    chunksCount: number;
    loaderType: string;
    splitterType: string;
    embedderModel: string;
    storageLocation: string;
  };
}

export const UploadTab: React.FC<UploadTabProps> = ({ showToast }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<UploadSettings>({
    splitterType: 'recursive',
    chunkSize: 1500,
    chunkOverlap: 200
  });
  const [showSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일명 단축 함수 (Linux 파일시스템 255자 제한 고려)
  const truncateFileName = useCallback((fileName: string, maxLength: number = 100): string => {
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    
    if (fileName.length <= maxLength) {
      return fileName;
    }
    
    const availableLength = maxLength - extension.length;
    const truncatedName = nameWithoutExt.substring(0, availableLength);
    
    return truncatedName + extension;
  }, []);

  // 파일 유효성 검사
  const validateFile = useCallback((file: File): string | null => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/html',
      'application/json', // JSON 파일 지원 추가
    ];
    
    // 확장자로도 체크
    const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown', '.doc', '.docx', '.xls', '.xlsx', '.html', '.htm', '.json'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return 'PDF, TXT, Markdown, Word, Excel, HTML, JSON 파일만 업로드 가능합니다.';
    }

    if (file.size > maxSize) {
      return '파일 크기는 50MB를 초과할 수 없습니다.';
    }

    // 파일명 길이 체크 및 자동 단축
    if (file.name.length > 100) {
      console.warn(`파일명이 길어서 자동 단축됩니다: ${file.name} -> ${truncateFileName(file.name)}`);
    }

    return null;
  }, [truncateFileName]);

  // 파일 추가
  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles: UploadFile[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        // 파일명이 길 경우 자동 단축
        const truncatedFileName = truncateFileName(file.name);
        const processedFile = file.name !== truncatedFileName 
          ? new File([file], truncatedFileName, { type: file.type, lastModified: file.lastModified })
          : file;

        validFiles.push({
          id: `${Date.now()}_${Math.random()}`,
          file: processedFile,
          originalFileName: file.name, // 원본 파일명 보존
          status: 'selected',
          progress: 0,
          settings: { ...globalSettings }
        });
      }
    });

    if (errors.length > 0) {
      showToast({
        type: 'error',
        message: errors.join('\n'),
      });
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, [globalSettings, showToast, validateFile, truncateFileName]);

  // 단일 파일을 ready 상태로 변경
  const markFileReady = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready' } : f
      )
    );
  };

  // 모든 파일을 ready 상태로 변경하고 자동으로 업로드 시작
  const markAllFilesReadyAndStart = () => {
    // 1단계: 모든 selected 파일을 ready로 변경
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'selected' ? { ...f, status: 'ready' } : f
      )
    );
    
    // 2단계: 잠시 후 업로드 자동 시작
    setTimeout(() => {
      const readyFiles = files.filter(f => f.status === 'selected');
      readyFiles.forEach(file => {
        uploadSingleFile({ ...file, status: 'ready' });
      });
    }, 200);
  };

  // 기존 개별 준비 기능 (개별 버튼용)
  const markAllFilesReady = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'selected' ? { ...f, status: 'ready' } : f
      )
    );
  };

  // 단일 파일 업로드 시작
  const startSingleFileUpload = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      uploadSingleFile(file);
    }
  };

  // 실패한 파일 재시도
  const retryFailedFile = (fileId: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId && f.status === 'failed'
          ? { ...f, status: 'ready', error: undefined, progress: 0 }
          : f
      )
    );
    
    // 상태를 ready로 변경한 후 즉시 업로드 시작
    setTimeout(() => {
      const file = files.find(f => f.id === fileId);
      if (file) {
        uploadSingleFile({ ...file, status: 'ready', error: undefined, progress: 0 });
      }
    }, 100);
  };

  // 모든 ready 상태 파일 업로드 시작
  const startAllUploads = () => {
    const readyFiles = files.filter(f => f.status === 'ready');
    readyFiles.forEach(file => {
      uploadSingleFile(file);
    });
  };

  // 단일 파일 업로드
  const uploadSingleFile = async (uploadFile: UploadFile) => {
    try {
      // 업로드 시작
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        )
      );

      const response = await documentAPI.upload(
        uploadFile.file,
        (progress) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress } : f
            )
          );
        },
        uploadFile.settings // 업로드 설정 전달
      );

      // 응답 구조 확인 및 처리
      const responseData = response.data;
      
      if (responseData.job_id || responseData.jobId) {
        // 처리 상태로 변경
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'processing', progress: 100 }
              : f
          )
        );

        // job_id 또는 jobId 중 존재하는 것 사용
        const jobId = responseData.job_id || responseData.jobId;
        
        // 처리 상태 확인
        checkUploadStatus(uploadFile.id, jobId);
      } else {
        throw new Error(responseData.message || responseData.error || '업로드 응답에 작업 ID가 없습니다.');
      }
    } catch (error: unknown) {
      // 에러 객체 안전하게 처리
      let errorMessage = '업로드 중 오류가 발생했습니다.';
      
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (typeof error.toString === 'function') {
          errorMessage = error.toString();
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'failed',
                error: errorMessage,
              }
            : f
        )
      );
      showToast({
        type: 'error',
        message: `${uploadFile.file.name} 업로드 실패: ${errorMessage}`,
      });
    }
  };

  // 업로드 상태 확인
  const checkUploadStatus = async (fileId: string, jobId: string) => {
    let checkCount = 0;
    const maxChecks = 360; // 최대 30분간 체크 (5초 * 360회)
    let failureCount = 0;
    const maxFailures = 5; // 연속 5회 실패 시 중단
    
    const checkInterval = setInterval(async () => {
      try {
        checkCount++;
        const response = await documentAPI.getUploadStatus(jobId);
        const status = response.data;
        
        // 성공적으로 응답을 받았으면 실패 카운터 리셋
        failureCount = 0;

        if (status.status === 'completed' || status.status === 'completed_with_errors') {
          clearInterval(checkInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: 'completed',
                    documentId: status.documentId || status.job_id,
                    processingDetails: {
                      processingTime: status.processing_time || 0,
                      chunksCount: status.chunk_count || 0,
                      loaderType: 'Markdown', // 백엔드에서 제공하지 않는 정보이므로 기본값
                      splitterType: 'Recursive', // 기본값
                      embedderModel: 'OpenAI', // 기본값 
                      storageLocation: 'Vector Database' // 기본값
                    }
                  }
                : f
            )
          );
          showToast({
            type: 'success',
            message: `문서가 성공적으로 업로드되었습니다. (${status.chunk_count || 0}개 청크 생성)`,
          });
        } else if (status.status === 'failed') {
          clearInterval(checkInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: 'failed',
                    error: status.error_message || status.error || '처리 중 오류가 발생했습니다.',
                  }
                : f
            )
          );
          showToast({
            type: 'error',
            message: '문서 처리에 실패했습니다.',
          });
        } else if (checkCount >= maxChecks) {
          // 타임아웃 처리 - 하지만 백엔드에서는 여전히 처리 중일 수 있음
          clearInterval(checkInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: 'failed',
                    error: '처리 시간이 너무 오래 걸립니다. 백엔드 로그를 확인해주세요.',
                  }
                : f
            )
          );
          showToast({
            type: 'warning',
            message: '파일 처리가 예상보다 오래 걸리고 있습니다. 백엔드에서는 계속 처리 중일 수 있습니다.',
          });
        }
      } catch (error: unknown) {
        // 네트워크 에러나 API 에러 처리
        failureCount++;
        const errorMessage = error?.message || error?.toString() || '상태 확인 중 오류가 발생했습니다.';
        
        console.warn(`상태 확인 실패 ${failureCount}/${maxFailures}:`, errorMessage);
        
        // 연속 실패 횟수가 임계값을 초과하면 중단
        if (failureCount >= maxFailures) {
          clearInterval(checkInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: 'failed',
                    error: `네트워크 오류로 상태 확인 실패 (${failureCount}회 연속)`,
                  }
                : f
            )
          );
          
          showToast({
            type: 'error',
            message: '네트워크 연결 문제로 상태 확인을 중단했습니다.',
          });
        }
      }
    }, 5000); // 5초마다 확인 (큰 문서 처리 대응)
  };

  // 파일 제거
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // 드래그 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
  };

  // 파일 크기 포맷
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Removed unused updateFileSettings function

  // 파일 상태별 색상
  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'ready': return 'primary';
      case 'uploading': case 'processing': return 'warning';
      default: return 'default';
    }
  };

  // 상태별 아이콘
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <InsertDriveFile />;
    }
  };

  // 상태별 한글 라벨
  const getStatusLabel = (status: UploadFile['status']) => {
    switch (status) {
      case 'selected': return '선택됨';
      case 'ready': return '준비됨';
      case 'uploading': return '업로드';
      case 'processing': return '처리중';
      case 'completed': return '완료';
      case 'failed': return '실패';
      default: return '알 수 없음';
    }
  };

  // 업로드 가능한 파일 개수
  const selectedFilesCount = files.filter(f => f.status === 'selected').length;
  const readyFilesCount = files.filter(f => f.status === 'ready').length;
  const processingFilesCount = files.filter(f => ['uploading', 'processing'].includes(f.status)).length;

  return (
    <Box>
      {/* 글로벌 설정 패널 */}
      {(selectedFilesCount > 0 || showSettings) && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            업로드 설정
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>스플리터</InputLabel>
              <Select
                value={globalSettings.splitterType}
                label="스플리터"
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, splitterType: e.target.value as 'recursive' | 'semantic' | 'markdown' }))}
              >
                <MenuItem value="recursive">Recursive</MenuItem>
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="semantic">Semantic</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="청크 크기"
              type="number"
              value={globalSettings.chunkSize}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 1500 }))}
              sx={{ width: 120 }}
            />
            <TextField
              size="small"
              label="청크 겹침"
              type="number"
              value={globalSettings.chunkOverlap}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 200 }))}
              sx={{ width: 120 }}
            />
            {selectedFilesCount > 0 && (
              <>
                <Button 
                  variant="contained" 
                  onClick={markAllFilesReadyAndStart}
                  disabled={processingFilesCount > 0}
                  startIcon={<PlayArrow />}
                  color="primary"
                >
                  일괄 처리 시작 ({selectedFilesCount}개)
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={markAllFilesReady}
                  disabled={processingFilesCount > 0}
                  size="small"
                >
                  준비만
                </Button>
                {readyFilesCount > 0 && (
                  <Button 
                    variant="outlined" 
                    onClick={startAllUploads}
                    disabled={processingFilesCount > 0}
                    startIcon={<CloudUpload />}
                    size="small"
                  >
                    준비된 파일 시작 ({readyFilesCount}개)
                  </Button>
                )}
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* 업로드 영역 */}
      <Paper
        sx={{
          p: 4,
          mb: 3,
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={2}
        >
          <CloudUpload sx={{ fontSize: 64, color: 'primary.main' }} />
          <Typography variant="h6">
            파일을 드래그하여 놓거나 클릭하여 선택하세요
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PDF, TXT, Markdown, Word, Excel, HTML, JSON 파일 (최대 50MB)
          </Typography>
          <Button variant="contained" startIcon={<CloudUpload />}>
            파일 선택
          </Button>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,.doc,.docx,.xls,.xlsx,.html,.htm,.json"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </Paper>

      {/* 업로드 파일 목록 */}
      {files.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            업로드 목록
          </Typography>
          <List>
            {files.map((file) => (
              <ListItem
                key={file.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemIcon>{getStatusIcon(file.status)}</ListItemIcon>
                <ListItemText
                  primary={file.file.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(file.file.size)}
                      </Typography>
                      {file.error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {file.error}
                        </Alert>
                      )}
                      {(file.status === 'uploading' ||
                        file.status === 'processing') && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={file.progress}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {file.status === 'uploading'
                              ? `업로드 중... ${file.progress}%`
                              : '처리 중...'}
                          </Typography>
                        </Box>
                      )}
                      {file.status === 'completed' && file.processingDetails && (
                        <ProcessingDetailsPanel details={file.processingDetails} fileName={file.file.name} />
                      )}
                    </Box>
                  }
                />
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={getStatusLabel(file.status)}
                    color={getStatusColor(file.status) as 'success' | 'error' | 'primary' | 'warning'}
                    size="small"
                  />
                  {file.status === 'selected' && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => markFileReady(file.id)}
                    >
                      준비
                    </Button>
                  )}
                  {file.status === 'ready' && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<PlayArrow />}
                      onClick={() => startSingleFileUpload(file.id)}
                      disabled={processingFilesCount > 0}
                    >
                      시작
                    </Button>
                  )}
                  {file.status === 'failed' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<Refresh />}
                      onClick={() => retryFailedFile(file.id)}
                    >
                      재시도
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => removeFile(file.id)}
                    disabled={
                      file.status === 'uploading' ||
                      file.status === 'processing'
                    }
                  >
                    <Close />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

// 처리 상세 정보 표시 컴포넌트
interface ProcessingDetailsPanelProps {
  details: UploadFile['processingDetails'];
  fileName: string;
}

const ProcessingDetailsPanel: React.FC<ProcessingDetailsPanelProps> = ({ details, fileName }) => {
  const [expanded, setExpanded] = useState(false);

  if (!details) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
        sx={{ textTransform: 'none' }}
      >
        처리 상세 정보
      </Button>
      <Collapse in={expanded}>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>처리 결과</Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Typography variant="body2">
              <strong>파일명:</strong> {fileName}
            </Typography>
            <Typography variant="body2">
              <strong>처리 시간:</strong> {(details.processingTime / 1000).toFixed(2)}초
            </Typography>
            <Typography variant="body2">
              <strong>생성된 청크:</strong> {details.chunksCount}개
            </Typography>
            <Typography variant="body2">
              <strong>사용된 로더:</strong> {details.loaderType}
            </Typography>
            <Typography variant="body2">
              <strong>사용된 스플리터:</strong> {details.splitterType}
            </Typography>
            <Typography variant="body2">
              <strong>임베딩 모델:</strong> {details.embedderModel}
            </Typography>
            <Typography variant="body2">
              <strong>저장 위치:</strong> {details.storageLocation}
            </Typography>
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
};