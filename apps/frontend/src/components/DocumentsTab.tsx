import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Chip,
  Pagination,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
} from '@mui/material';
import {
  Search,
  Delete,
  Info,
  Download,
  Refresh,
  DeleteSweep,
  CheckCircle,
  Error,
  HourglassEmpty,
  ArrowUpward,
  ArrowDownward,
  ViewList,
  ViewModule,
  Warning,
} from '@mui/icons-material';
import { Document, ToastMessage } from '../types';
import { documentAPI } from '../services/api';

interface DocumentsTabProps {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ showToast }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteAllStep, setDeleteAllStep] = useState<'confirm' | 'typing'>("confirm");
  const [deleteAllTyping, setDeleteAllTyping] = useState('');
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  
  // 정렬 및 뷰 상태
  const [sortField, setSortField] = useState<'filename' | 'size' | 'uploadedAt' | 'type'>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // 문서 삭제 취소 핸들러
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setDocumentToDelete(null);
  }, []);

  // 벌크 삭제 취소 핸들러
  const handleBulkDeleteCancel = useCallback(() => {
    setBulkDeleteConfirmOpen(false);
  }, []);

  // 전체 삭제 취소 핸들러
  const handleDeleteAllCancel = useCallback(() => {
    setDeleteAllConfirmOpen(false);
    setDeleteAllStep('confirm');
    setDeleteAllTyping('');
  }, []);

  const pageSize = 50;

  // 문서 정렬 함수
  const sortDocuments = useCallback((docs: Document[]) => {
    return [...docs].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'uploadedAt':
          aValue = new Date(a.uploadedAt).getTime();
          bValue = new Date(b.uploadedAt).getTime();
          break;
        case 'type':
          aValue = a.filename.split('.').pop()?.toLowerCase() || '';
          bValue = b.filename.split('.').pop()?.toLowerCase() || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortField, sortDirection]);

  // 정렬 변경 핸들러
  const handleSort = useCallback((field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // 문서 목록 조회
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await documentAPI.getDocuments({
        page,
        limit: pageSize,
        search: searchQuery,
      });
      const sortedDocuments = sortDocuments(response.data.documents);
      setDocuments(sortedDocuments);
      setTotalPages(Math.ceil(response.data.total / pageSize));
    } catch {
      showToast({
        type: 'error',
        message: '문서 목록을 불러오는데 실패했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, showToast, sortDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]); // fetchDocuments callback으로 의존성 관리

  // 유효한 문서 ID인지 확인하는 함수
  const isValidDocumentId = (id: string): boolean => {
    return id && !id.startsWith('temp-') && id.trim() !== '';
  };

  // 문서 선택/해제
  const toggleDocumentSelection = (id: string) => {
    // 임시 ID나 유효하지 않은 ID는 선택하지 않음
    if (!isValidDocumentId(id)) {
      showToast({
        type: 'warning',
        message: '이 문서는 선택할 수 없습니다.',
      });
      return;
    }
    
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedDocuments(newSelection);
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const validDocuments = documents.filter(doc => isValidDocumentId(doc.id));
    const validIds = validDocuments.map(doc => doc.id);
    
    if (selectedDocuments.size === validIds.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(validIds));
    }
  };

  // 문서 상세 정보 보기
  const handleViewDetails = (document: Document) => {
    setSelectedDocument(document);
    setDetailsOpen(true);
  };

  // 문서 삭제 확인
  const handleDeleteClick = useCallback((id: string) => {
    setDocumentToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  // 문서 삭제
  const handleDeleteConfirm = useCallback(async () => {
    if (!documentToDelete) return;

    setDeleteLoading(true);
    try {
      await documentAPI.deleteDocument(documentToDelete);
      showToast({
        type: 'success',
        message: '문서가 성공적으로 삭제되었습니다.',
      });
      await fetchDocuments();
    } catch (error: unknown) {
      console.error('Document delete error:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      showToast({
        type: 'error',
        message: apiError.response?.data?.message || '문서 삭제에 실패했습니다.',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDocumentToDelete(null);
    }
  }, [documentToDelete, showToast, fetchDocuments]);

  // 일괄 삭제
  const handleBulkDelete = useCallback(async () => {
    if (selectedDocuments.size === 0) {
      setBulkDeleteConfirmOpen(false);
      return;
    }

    setBulkDeleteLoading(true);
    try {
      const documentIds = Array.from(selectedDocuments).filter(isValidDocumentId);
      console.log('Deleting documents:', documentIds);
      
      if (documentIds.length === 0) {
        showToast({
          type: 'warning',
          message: '삭제할 수 있는 유효한 문서가 없습니다.',
        });
        return;
      }
      
      await documentAPI.deleteDocuments(documentIds);
      showToast({
        type: 'success',
        message: `${selectedDocuments.size}개의 문서가 성공적으로 삭제되었습니다.`,
      });
      setSelectedDocuments(new Set());
      await fetchDocuments();
    } catch (error: unknown) {
      console.error('Bulk delete error:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      showToast({
        type: 'error',
        message: apiError.response?.data?.message || '문서 일괄 삭제에 실패했습니다.',
      });
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteConfirmOpen(false);
    }
  }, [selectedDocuments, showToast, fetchDocuments]);

  // 전체 문서 삭제
  const handleDeleteAll = useCallback(async () => {
    if (deleteAllStep === 'confirm') {
      setDeleteAllStep('typing');
      return;
    }

    if (deleteAllTyping !== '문서 삭제에 동의합니다.') {
      showToast({
        type: 'error',
        message: '정확한 문구를 입력해주세요: "문서 삭제에 동의합니다."',
      });
      return;
    }

    setDeleteAllLoading(true);
    try {
      await documentAPI.deleteAllDocuments(
        'DELETE_ALL_DOCUMENTS', 
        '사용자 요청에 의한 전체 문서 삭제',
        false
      );
      showToast({
        type: 'success',
        message: '모든 문서가 성공적으로 삭제되었습니다.',
      });
      setSelectedDocuments(new Set());
      await fetchDocuments();
      handleDeleteAllCancel();
    } catch (error: unknown) {
      console.error('Delete all documents error:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      showToast({
        type: 'error',
        message: apiError.response?.data?.message || '전체 문서 삭제에 실패했습니다.',
      });
    } finally {
      setDeleteAllLoading(false);
    }
  }, [deleteAllStep, deleteAllTyping, showToast, fetchDocuments, handleDeleteAllCancel]);

  // 문서 다운로드
  const handleDownload = async (document: Document) => {
    try {
      const response = await documentAPI.downloadDocument(document.id);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = globalThis.document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast({
        type: 'error',
        message: '문서 다운로드에 실패했습니다.',
      });
    }
  };

  // 상태별 아이콘 반환
  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'processing':
        return <HourglassEmpty color="warning" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return null;
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* 검색 및 액션 바 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="문서 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>정렬 기준</InputLabel>
              <Select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as typeof sortField)}
                label="정렬 기준"
              >
                <MenuItem value="uploadedAt">업로드 일시</MenuItem>
                <MenuItem value="filename">파일명</MenuItem>
                <MenuItem value="size">파일 크기</MenuItem>
                <MenuItem value="type">파일 타입</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs="auto">
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                color="primary"
                size="small"
              >
                {sortDirection === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
              </IconButton>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="grid">
                  <ViewModule />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedDocuments.size === documents.length && documents.length > 0}
                    indeterminate={selectedDocuments.size > 0 && selectedDocuments.size < documents.length}
                    onChange={toggleSelectAll}
                  />
                }
                label="전체 선택"
              />
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteSweep />}
                onClick={() => setBulkDeleteConfirmOpen(true)}
                disabled={selectedDocuments.size === 0}
              >
                선택 삭제 ({selectedDocuments.size})
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Warning />}
                onClick={() => setDeleteAllConfirmOpen(true)}
                sx={{ minWidth: '120px' }}
              >
                모든 문서 삭제
              </Button>
              <IconButton onClick={fetchDocuments} color="primary">
                <Refresh />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 문서 목록 */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {viewMode === 'list' ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedDocuments.size === documents.length && documents.length > 0}
                        indeterminate={selectedDocuments.size > 0 && selectedDocuments.size < documents.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'filename'}
                        direction={sortField === 'filename' ? sortDirection : 'asc'}
                        onClick={() => handleSort('filename')}
                      >
                        파일명
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'size'}
                        direction={sortField === 'size' ? sortDirection : 'asc'}
                        onClick={() => handleSort('size')}
                      >
                        크기
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'uploadedAt'}
                        direction={sortField === 'uploadedAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('uploadedAt')}
                      >
                        업로드 일시
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell align="center">액션</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow 
                      key={document.id}
                      selected={selectedDocuments.has(document.id)}
                      hover
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedDocuments.has(document.id)}
                          onChange={() => toggleDocumentSelection(document.id)}
                          disabled={!isValidDocumentId(document.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(document.status)}
                          <Typography variant="body2" noWrap>
                            {document.originalName || document.filename}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatFileSize(document.size)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(document.uploadedAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit', 
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={document.status} 
                          size="small"
                          color={
                            document.status === 'completed' ? 'success' :
                            document.status === 'failed' ? 'error' : 'warning'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" gap={1}>
                          <IconButton size="small" onClick={() => handleViewDetails(document)}>
                            <Info fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDownload(document)}>
                            <Download fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => handleDeleteClick(document.id)}
                            disabled={!isValidDocumentId(document.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Grid container spacing={2}>
              {documents.map((document) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={document.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'relative',
                    ...(selectedDocuments.has(document.id) && {
                      border: '2px solid',
                      borderColor: 'primary.main',
                    }),
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <Checkbox
                      checked={selectedDocuments.has(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      color="primary"
                      disabled={!isValidDocumentId(document.id)}
                    />
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      {getStatusIcon(document.status)}
                      <Typography variant="h6" noWrap>
                        {document.originalName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      크기: {formatFileSize(document.size)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      업로드: {new Date(document.uploadedAt).toLocaleString()}
                    </Typography>
                    {document.chunks && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        청크: {document.chunks}개
                      </Typography>
                    )}
                    <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                      <Chip 
                        label={document.status} 
                        size="small" 
                        color={
                          document.status === 'completed' ? 'success' :
                          document.status === 'processing' ? 'warning' : 'error'
                        }
                      />
                      {!isValidDocumentId(document.id) && (
                        <Chip 
                          label="로딩 중" 
                          size="small" 
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button size="small" onClick={() => handleViewDetails(document)}>
                      <Info fontSize="small" sx={{ mr: 0.5 }} />
                      상세
                    </Button>
                    <Button size="small" onClick={() => handleDownload(document)}>
                      <Download fontSize="small" sx={{ mr: 0.5 }} />
                      다운로드
                    </Button>
                    <Button 
                      size="small" 
                      color="error"
                      onClick={() => handleDeleteClick(document.id)}
                      disabled={!isValidDocumentId(document.id)}
                    >
                      <Delete fontSize="small" sx={{ mr: 0.5 }} />
                      삭제
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
                ))}
              </Grid>
            )
          }

          {/* 페이지네이션 */}
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        </>
      )}

      {/* 문서 상세 정보 다이얼로그 */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>문서 상세 정보</DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <List>
              <ListItem>
                <ListItemText primary="파일명" secondary={selectedDocument.originalName} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="ID" secondary={selectedDocument.id} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="크기" secondary={formatFileSize(selectedDocument.size)} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="MIME 타입" secondary={selectedDocument.mimeType} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="업로드 일시" secondary={new Date(selectedDocument.uploadedAt).toLocaleString()} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="상태" secondary={selectedDocument.status} />
              </ListItem>
              {selectedDocument.chunks && (
                <>
                  <Divider />
                  <ListItem>
                    <ListItemText primary="청크 수" secondary={`${selectedDocument.chunks}개`} />
                  </ListItem>
                </>
              )}
              {selectedDocument.metadata && (
                <>
                  {selectedDocument.metadata.pageCount && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText primary="페이지 수" secondary={`${selectedDocument.metadata.pageCount}페이지`} />
                      </ListItem>
                    </>
                  )}
                  {selectedDocument.metadata.wordCount && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText primary="단어 수" secondary={`${selectedDocument.metadata.wordCount}개`} />
                      </ListItem>
                    </>
                  )}
                </>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={!deleteLoading ? handleDeleteCancel : undefined}
        disableEscapeKeyDown={deleteLoading}
      >
        <DialogTitle>문서 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>이 문서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel}
            color="inherit"
            disabled={deleteLoading}
          >
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={!documentToDelete || deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
          >
            {deleteLoading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 일괄 삭제 확인 다이얼로그 */}
      <Dialog 
        open={bulkDeleteConfirmOpen} 
        onClose={!bulkDeleteLoading ? handleBulkDeleteCancel : undefined}
        disableEscapeKeyDown={bulkDeleteLoading}
      >
        <DialogTitle>문서 일괄 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            선택한 {selectedDocuments.size}개의 문서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleBulkDeleteCancel}
            color="inherit"
            disabled={bulkDeleteLoading}
          >
            취소
          </Button>
          <Button 
            onClick={handleBulkDelete} 
            color="error" 
            variant="contained"
            disabled={selectedDocuments.size === 0 || bulkDeleteLoading}
            startIcon={bulkDeleteLoading ? <CircularProgress size={16} /> : null}
          >
            {bulkDeleteLoading ? '삭제 중...' : `삭제 (${selectedDocuments.size}개)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 전체 문서 삭제 확인 다이얼로그 */}
      <Dialog 
        open={deleteAllConfirmOpen} 
        onClose={!deleteAllLoading ? handleDeleteAllCancel : undefined}
        disableEscapeKeyDown={deleteAllLoading}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <Warning />
          전체 문서 삭제 확인
        </DialogTitle>
        <DialogContent>
          {deleteAllStep === 'confirm' ? (
            <Typography>
              ⚠️ <strong>DB에 등록한 문서가 모두 삭제 됩니다.</strong>
              <br />
              <br />
              이 작업은 되돌릴 수 없으며, Qdrant DB의 모든 문서와 벡터가 완전히 삭제됩니다.
              <br />
              <br />
              계속하시겠습니까?
            </Typography>
          ) : (
            <Box>
              <Typography gutterBottom>
                삭제를 확인하려면 아래 문구를 정확히 입력해주세요:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  p: 1, 
                  bgcolor: 'grey.100', 
                  fontFamily: 'monospace', 
                  borderRadius: 1,
                  mb: 2
                }}
              >
                문서 삭제에 동의합니다.
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="위 문구를 정확히 입력하세요"
                value={deleteAllTyping}
                onChange={(e) => setDeleteAllTyping(e.target.value)}
                disabled={deleteAllLoading}
                error={deleteAllTyping.length > 0 && deleteAllTyping !== '문서 삭제에 동의합니다.'}
                helperText={
                  deleteAllTyping.length > 0 && deleteAllTyping !== '문서 삭제에 동의합니다.' 
                    ? '정확한 문구를 입력해주세요' 
                    : ''
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteAllCancel}
            color="inherit"
            disabled={deleteAllLoading}
          >
            취소
          </Button>
          {deleteAllStep === 'confirm' ? (
            <Button 
              onClick={handleDeleteAll} 
              color="error" 
              variant="contained"
              disabled={deleteAllLoading}
            >
              다음 단계
            </Button>
          ) : (
            <Button 
              onClick={handleDeleteAll} 
              color="error" 
              variant="contained"
              disabled={deleteAllTyping !== '문서 삭제에 동의합니다.' || deleteAllLoading}
              startIcon={deleteAllLoading ? <CircularProgress size={16} /> : null}
            >
              {deleteAllLoading ? '삭제 중...' : '모든 문서 삭제'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};