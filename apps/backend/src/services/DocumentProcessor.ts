import fs from 'fs/promises';
import path from 'path';
import { promises as fsPromises } from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import { vectorService, DocumentChunk } from '@/services/VectorService';
import crypto from 'crypto';

const logger = getLogger('DocumentProcessor');

export interface ProcessingResult {
  success: boolean;
  document_id: string;
  filename: string;
  file_type: string;
  total_chunks: number;
  processing_time: number;
  chunks_created: DocumentChunk[];
  error?: string;
}

export interface ProcessingOptions {
  chunk_size?: number;
  chunk_overlap?: number;
  preserve_formatting?: boolean;
  extract_metadata?: boolean;
}

export interface DocumentMetadata {
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  processing_date: string;
  total_pages?: number;
  author?: string;
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string[];
}

export class DocumentProcessor {
  private static instance: DocumentProcessor;
  private readonly supportedTypes = ['pdf', 'txt', 'docx', 'xlsx', 'csv'];
  private readonly defaultChunkSize = 1000;
  private readonly defaultOverlap = 200;

  private constructor() {}

  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  public async processDocument(
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const filename = path.basename(filePath);
    const fileExt = path.extname(filename).toLowerCase().slice(1);
    const documentId = this.generateDocumentId(filename);

    const processingOptions = {
      chunk_size: options.chunk_size || this.defaultChunkSize,
      chunk_overlap: options.chunk_overlap || this.defaultOverlap,
      preserve_formatting: options.preserve_formatting || false,
      extract_metadata: options.extract_metadata || true,
    };

    logger.info('Starting document processing', {
      filename,
      fileType: fileExt,
      documentId,
      options: processingOptions,
    });

    try {
      // 파일 타입 검증
      if (!this.supportedTypes.includes(fileExt)) {
        throw new Error(`Unsupported file type: ${fileExt}. Supported types: ${this.supportedTypes.join(', ')}`);
      }

      // 파일 존재 여부 확인
      await fs.access(filePath);
      const fileStats = await fs.stat(filePath);

      // 파일 크기 제한 확인 (100MB)
      const maxFileSize = 100 * 1024 * 1024; // 100MB
      if (fileStats.size > maxFileSize) {
        throw new Error(`File too large: ${Math.round(fileStats.size / 1024 / 1024)}MB. Max size: 100MB`);
      }

      // 메타데이터 추출
      const metadata: DocumentMetadata = {
        filename,
        file_type: fileExt,
        file_size: fileStats.size,
        upload_date: fileStats.birthtime.toISOString(),
        processing_date: new Date().toISOString(),
      };

      // 파일 타입에 따른 텍스트 추출
      let extractedText: string;
      let extractedMetadata: Partial<DocumentMetadata> = {};

      switch (fileExt) {
        case 'pdf':
          const pdfResult = await this.processPDF(filePath);
          extractedText = pdfResult.text;
          extractedMetadata = pdfResult.metadata;
          break;

        case 'docx':
          const docxResult = await this.processDOCX(filePath);
          extractedText = docxResult.text;
          extractedMetadata = docxResult.metadata;
          break;

        case 'txt':
          extractedText = await this.processTXT(filePath);
          break;

        case 'xlsx':
          extractedText = await this.processXLSX(filePath);
          break;

        case 'csv':
          extractedText = await this.processCSV(filePath);
          break;

        default:
          throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // 메타데이터 병합
      const finalMetadata = { ...metadata, ...extractedMetadata };

      // 텍스트가 비어있는지 확인
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }

      // 텍스트를 청크로 분할
      const chunks = this.splitTextIntoChunks(
        extractedText,
        processingOptions.chunk_size,
        processingOptions.chunk_overlap
      );

      // DocumentChunk 객체 생성
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        id: this.generateChunkId(documentId, index),
        content: chunk,
        metadata: {
          source: filename,
          chunk_index: index,
          chunk_size: chunk.length,
          document_id: documentId,
          created_at: new Date().toISOString(),
          ...finalMetadata,
        },
      }));

      // 벡터 데이터베이스에 저장
      let vectorStoreSuccess = false;
      if (vectorService.isAvailable()) {
        try {
          await vectorService.addDocuments(documentChunks);
          vectorStoreSuccess = true;
          logger.info('Document chunks stored in vector database', {
            documentId,
            chunksStored: documentChunks.length,
          });
        } catch (vectorError) {
          logger.warn('Failed to store chunks in vector database', {
            documentId,
            error: vectorError,
          });
        }
      } else {
        logger.warn('Vector service not available, chunks not stored', {
          documentId,
        });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Document processing completed successfully', {
        documentId,
        filename,
        fileType: fileExt,
        fileSize: fileStats.size,
        chunksCreated: documentChunks.length,
        processingTime: `${processingTime}ms`,
        vectorStoreSuccess,
      });

      return {
        success: true,
        document_id: documentId,
        filename,
        file_type: fileExt,
        total_chunks: documentChunks.length,
        processing_time: processingTime,
        chunks_created: documentChunks,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.logError(error as Error, 'Document processing failed', {
        filename,
        fileType: fileExt,
        documentId,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: false,
        document_id: documentId,
        filename,
        file_type: fileExt,
        total_chunks: 0,
        processing_time: processingTime,
        chunks_created: [],
        error: errorMessage,
      };
    }
  }

  private async processPDF(filePath: string): Promise<{ text: string; metadata: Partial<DocumentMetadata> }> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);

      const metadata: Partial<DocumentMetadata> = {
        total_pages: pdfData.numpages,
        title: pdfData.info?.Title || undefined,
        author: pdfData.info?.Author || undefined,
        subject: pdfData.info?.Subject || undefined,
        creator: pdfData.info?.Creator || undefined,
        keywords: pdfData.info?.Keywords ? [pdfData.info.Keywords] : [],
      };

      return {
        text: pdfData.text,
        metadata,
      };
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processDOCX(filePath: string): Promise<{ text: string; metadata: Partial<DocumentMetadata> }> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });

      // DOCX에서 추출할 수 있는 메타데이터는 제한적
      const metadata: Partial<DocumentMetadata> = {};

      return {
        text: result.value,
        metadata,
      };
    } catch (error) {
      throw new Error(`Failed to process DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processTXT(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to process TXT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processXLSX(filePath: string): Promise<string> {
    try {
      const workbook = XLSX.readFile(filePath);
      const textContent: string[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet) {
          const csvString = XLSX.utils.sheet_to_csv(worksheet);
          textContent.push(`Sheet: ${sheetName}\n${csvString}\n`);
        }
      });

      return textContent.join('\n');
    } catch (error) {
      throw new Error(`Failed to process XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processCSV(filePath: string): Promise<string> {
    try {
      const results: string[] = [];
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      return new Promise((resolve, reject) => {
        const stream = Readable.from(fileContent);
        
        stream
          .pipe(csv())
          .on('data', (row) => {
            // CSV 행을 텍스트로 변환
            const rowText = Object.entries(row)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            results.push(rowText);
          })
          .on('end', () => {
            resolve(results.join('\n'));
          })
          .on('error', (error) => {
            reject(new Error(`Failed to process CSV: ${error.message}`));
          });
      });
    } catch (error) {
      throw new Error(`Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // 단어 경계에서 자르기 (마지막 청크가 아닌 경우)
      if (end < text.length) {
        const lastSpaceIndex = text.lastIndexOf(' ', end);
        const lastNewlineIndex = text.lastIndexOf('\n', end);
        const lastPeriodIndex = text.lastIndexOf('.', end);
        
        const bestCutPoint = Math.max(lastSpaceIndex, lastNewlineIndex, lastPeriodIndex);
        if (bestCutPoint > start + chunkSize * 0.5) {
          end = bestCutPoint + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = Math.max(start + chunkSize - overlap, end);
    }

    return chunks;
  }

  private generateDocumentId(filename: string): string {
    const timestamp = Date.now().toString();
    const hash = crypto.createHash('md5').update(filename + timestamp).digest('hex').slice(0, 8);
    return `doc_${hash}`;
  }

  private generateChunkId(documentId: string, chunkIndex: number): string {
    return `${documentId}_chunk_${chunkIndex.toString().padStart(3, '0')}`;
  }

  public getSupportedTypes(): string[] {
    return [...this.supportedTypes];
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // 벡터 데이터베이스에서 문서 삭제
      if (vectorService.isAvailable()) {
        const success = await vectorService.deleteDocument(documentId);
        logger.info('Document deleted from processing system', {
          documentId,
          vectorStoreSuccess: success,
        });
        return success;
      } else {
        logger.warn('Vector service not available, document deletion skipped', {
          documentId,
        });
        return false;
      }
    } catch (error) {
      logger.logError(error as Error, 'Failed to delete document', {
        documentId,
      });
      return false;
    }
  }

  public async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('Temporary file cleaned up', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup temporary file', { filePath, error });
    }
  }

  public getProcessingStats(): {
    supportedTypes: string[];
    defaultChunkSize: number;
    defaultOverlap: number;
    maxFileSize: string;
  } {
    return {
      supportedTypes: this.supportedTypes,
      defaultChunkSize: this.defaultChunkSize,
      defaultOverlap: this.defaultOverlap,
      maxFileSize: '100MB',
    };
  }
}

// 싱글톤 인스턴스 export
export const documentProcessor = DocumentProcessor.getInstance();