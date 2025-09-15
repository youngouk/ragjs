import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import { UploadResponse, UploadStatus, FileProcessingJob } from '@/types';
import { documentProcessor } from '@/services/DocumentProcessor';

const router = express.Router();
const logger = getLogger('UploadRoute');

// UUID 생성 함수 (crypto 모듈 사용)
function generateUUID(): string {
  return crypto.randomUUID();
}

// 파일 업로드를 위한 Multer 설정
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(config.upload.upload_dir, { recursive: true });
      cb(null, config.upload.upload_dir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // 원본 파일명 보존하되 중복 방지를 위해 UUID 추가
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${basename}_${generateUUID()}${ext}`;
    cb(null, filename);
  }
});

// 파일 필터링
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (config.upload.allowed_types.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error(`File type .${ext} is not allowed. Allowed types: ${config.upload.allowed_types.join(', ')}`);
    (error as any).code = 'INVALID_FILE_TYPE';
    cb(error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.max_file_size,
    files: 1, // 한 번에 하나의 파일만 업로드
  },
});

// 파일 처리 작업 저장소 (실제로는 Redis나 Database 사용)
const processingJobs = new Map<string, FileProcessingJob>();

// 파일 업로드 엔드포인트
router.post('/', upload.single('file'), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.error('No file provided', 'NO_FILE', 400);
      return;
    }

    const jobId = generateUUID();
    const job: FileProcessingJob = {
      id: jobId,
      filename: req.file.originalname,
      status: 'processing',
      progress: 0,
      created_at: new Date().toISOString(),
    };

    // 작업 저장
    processingJobs.set(jobId, job);

    logger.info('File uploaded successfully', {
      jobId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    // 백그라운드에서 파일 처리 시작
    processFileAsync(jobId, req.file);

    const response: UploadResponse = {
      success: true,
      jobId,
      message: 'File uploaded successfully. Processing started.',
    };

    res.success(response);

  } catch (error) {
    logger.logError(error as Error, 'File upload failed');
    
    // 업로드된 파일이 있다면 정리
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup uploaded file', { path: req.file.path, error: cleanupError });
      }
    }

    res.error('File upload failed', 'UPLOAD_ERROR', 500);
  }
});

// 업로드 상태 확인 엔드포인트
router.get('/status/:jobId', (req, res): void => {
  try {
    const { jobId } = req.params;
    const job = processingJobs.get(jobId);

    if (!job) {
      res.error('Job not found', 'JOB_NOT_FOUND', 404);
      return;
    }

    const status: UploadStatus = {
      job_id: job.id,
      status: job.status === 'pending' ? 'processing' : job.status,
      progress: job.progress,
      message: getStatusMessage(job),
      filename: job.filename,
      document_id: job.id, // 임시로 jobId 사용
      ...(job.error && { error: job.error }),
    };

    res.success(status);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get upload status');
    res.error('Failed to retrieve upload status', 'STATUS_ERROR', 500);
  }
});

// 문서 목록 조회 엔드포인트
router.get('/documents', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;

    // TODO: 실제 데이터베이스에서 문서 조회
    // 현재는 임시 데이터 반환
    const documents = Array.from(processingJobs.values())
      .filter(job => job.status === 'completed')
      .filter(job => !search || job.filename.toLowerCase().includes(search.toLowerCase()))
      .filter(job => !status || job.status === status)
      .slice((page - 1) * limit, page * limit)
      .map(job => ({
        id: job.id,
        filename: job.filename,
        file_type: path.extname(job.filename).slice(1),
        file_size: 0, // TODO: 실제 파일 크기
        upload_date: job.created_at,
        status: job.status,
        chunk_count: job.chunks_created || 0,
        processing_time: job.completed_at 
          ? new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()
          : null,
        error_message: job.error || null,
      }));

    const response = {
      documents,
      total: processingJobs.size,
      page,
      limit,
    };

    res.success(response);

  } catch (error) {
    logger.logError(error as Error, 'Failed to get documents');
    res.error('Failed to retrieve documents', 'DOCUMENTS_ERROR', 500);
  }
});

// 문서 삭제 엔드포인트
router.delete('/documents/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const job = processingJobs.get(id);

    if (!job) {
      res.error('Document not found', 'DOCUMENT_NOT_FOUND', 404);
      return;
    }

    // TODO: 실제 구현
    // 1. 벡터 데이터베이스에서 문서 청크 삭제
    // 2. 파일 시스템에서 원본 파일 삭제
    // 3. 메타데이터 삭제

    processingJobs.delete(id);

    logger.info('Document deleted', { documentId: id, filename: job.filename });

    res.success({ message: 'Document deleted successfully' });

  } catch (error) {
    logger.logError(error as Error, 'Failed to delete document');
    res.error('Failed to delete document', 'DELETE_ERROR', 500);
  }
});

// 일괄 삭제 엔드포인트
router.post('/documents/bulk-delete', async (req, res): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.error('Invalid document IDs', 'INVALID_IDS', 400);
      return;
    }

    if (ids.length > 100) {
      res.error('Too many documents to delete at once (max: 100)', 'TOO_MANY_IDS', 400);
      return;
    }

    const results = {
      successful: [] as string[],
      failed: [] as { id: string; reason: string }[],
    };

    for (const id of ids) {
      try {
        const job = processingJobs.get(id);
        if (!job) {
          results.failed.push({ id, reason: 'Document not found' });
          continue;
        }

        // TODO: 실제 삭제 로직 구현
        processingJobs.delete(id);
        results.successful.push(id);

      } catch (error) {
        results.failed.push({ 
          id, 
          reason: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    logger.info('Bulk delete completed', {
      totalRequested: ids.length,
      successful: results.successful.length,
      failed: results.failed.length,
    });

    res.success({
      message: `Successfully deleted ${results.successful.length} documents`,
      results,
    });

  } catch (error) {
    logger.logError(error as Error, 'Bulk delete failed');
    res.error('Bulk delete operation failed', 'BULK_DELETE_ERROR', 500);
  }
});

// 파일 비동기 처리 함수
async function processFileAsync(jobId: string, file: Express.Multer.File) {
  const job = processingJobs.get(jobId);
  if (!job) return;

  try {
    // 처리 시작
    job.status = 'processing';
    job.progress = 10;
    processingJobs.set(jobId, job);

    logger.info('Starting file processing', { jobId, filename: file.filename });

    // 실제 문서 처리 파이프라인 실행
    job.progress = 20;
    processingJobs.set(jobId, job);

    const processingResult = await documentProcessor.processDocument(file.path, {
      chunk_size: 1000,
      chunk_overlap: 200,
      preserve_formatting: false,
      extract_metadata: true,
    });

    job.progress = 80;
    processingJobs.set(jobId, job);

    if (processingResult.success) {
      // 처리 완료
      job.status = 'completed';
      job.progress = 100;
      job.completed_at = new Date().toISOString();
      job.chunks_created = processingResult.total_chunks;
      job.document_id = processingResult.document_id;
      processingJobs.set(jobId, job);

      logger.info('File processing completed', { 
        jobId, 
        filename: file.filename,
        documentId: processingResult.document_id,
        chunksCreated: job.chunks_created,
        processingTime: `${processingResult.processing_time}ms`,
      });

      // 임시 파일 정리
      await documentProcessor.cleanupTempFile(file.path);
    } else {
      throw new Error(processingResult.error || 'Document processing failed');
    }

  } catch (error) {
    // 처리 실패
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Processing failed';
    job.completed_at = new Date().toISOString();
    processingJobs.set(jobId, job);

    logger.logError(error as Error, 'File processing failed', { jobId, filename: file.filename });

    // 실패 시에도 임시 파일 정리
    try {
      await documentProcessor.cleanupTempFile(file.path);
    } catch (cleanupError) {
      logger.warn('Failed to cleanup file after processing failure', { 
        filePath: file.path, 
        error: cleanupError 
      });
    }
  }
}

// 상태 메시지 생성 함수
function getStatusMessage(job: FileProcessingJob): string {
  switch (job.status) {
    case 'pending':
      return 'File uploaded, waiting to be processed';
    case 'processing':
      if (job.progress < 30) return 'Parsing document content...';
      if (job.progress < 50) return 'Splitting text into chunks...';
      if (job.progress < 70) return 'Generating embeddings...';
      if (job.progress < 90) return 'Storing in vector database...';
      return 'Finalizing processing...';
    case 'completed':
      return `Successfully processed into ${job.chunks_created || 0} chunks`;
    case 'failed':
      return job.error || 'Processing failed';
    default:
      return 'Unknown status';
  }
}

export default router;