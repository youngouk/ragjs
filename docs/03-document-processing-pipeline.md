# 문서 처리 및 저장 과정 가이드

## 📋 개요

이 문서는 Simple RAG 시스템에서 문서가 업로드된 후 어떻게 처리되어 벡터 데이터베이스에 저장되는지를 초보 개발자가 이해할 수 있도록 단계별로 설명합니다.

## 🔄 문서 처리 파이프라인 전체 흐름

```
파일 업로드 → 형식 검증 → 텍스트 추출 → 청크 분할 → 임베딩 생성 → 벡터 DB 저장
```

## 📁 지원 파일 형식

### 현재 지원 형식
- **PDF** (.pdf) - Adobe PDF 문서
- **DOCX** (.docx) - Microsoft Word 문서  
- **TXT** (.txt) - 일반 텍스트 파일
- **XLSX** (.xlsx) - Microsoft Excel 스프레드시트
- **CSV** (.csv) - 쉼표로 구분된 값 파일

### 파일 제한사항
- **최대 파일 크기**: 100MB
- **한 번에 업로드**: 1개 파일
- **허용 문자 인코딩**: UTF-8

## 🚀 단계별 문서 처리 과정

### 1단계: 파일 업로드 및 초기 검증
**위치**: `src/routes/upload.ts` - POST `/api/upload`

#### 1-1. 멀터(Multer) 파일 처리
```typescript
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // uploads/ 폴더에 파일 저장
    await fs.mkdir(config.upload.upload_dir, { recursive: true });
    cb(null, config.upload.upload_dir);
  },
  filename: (req, file, cb) => {
    // 중복 방지를 위해 UUID 추가
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${basename}_${generateUUID()}${ext}`;
    cb(null, filename);
  }
});
```

**처리 내용**:
- 파일을 `uploads/` 폴더에 저장
- 파일명 중복 방지를 위해 UUID 추가
- 예시: `계약서.pdf` → `계약서_abc123-def456-789.pdf`

#### 1-2. 파일 형식 및 크기 검증
```typescript
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (config.upload.allowed_types.includes(ext)) {
    cb(null, true);  // 허용된 파일 형식
  } else {
    const error = new Error(`File type .${ext} is not allowed`);
    cb(error);  // 거부
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.max_file_size,  // 100MB 제한
    files: 1  // 한 번에 1개 파일
  }
});
```

### 2단계: 백그라운드 비동기 처리 시작
**위치**: `src/routes/upload.ts` - `processFileAsync()` 함수

```typescript
// 작업 ID 생성 및 초기 상태 설정
const jobId = generateUUID();
const job = {
  id: jobId,
  filename: req.file.originalname,
  status: 'processing',
  progress: 0,
  created_at: new Date().toISOString()
};

// 백그라운드에서 처리 시작
processFileAsync(jobId, req.file);

// 즉시 응답 반환 (non-blocking)
res.success({
  success: true,
  jobId,
  message: 'File uploaded successfully. Processing started.'
});
```

**사용자 경험**:
- 사용자는 파일 업로드 후 즉시 응답 받음
- `jobId`로 처리 상태를 추후 확인 가능

### 3단계: DocumentProcessor를 통한 문서 처리
**위치**: `src/services/DocumentProcessor.ts` - `processDocument()` 메서드

#### 3-1. 파일 정보 수집 및 검증
```typescript
// 파일 존재 여부 및 크기 확인
await fs.access(filePath);
const fileStats = await fs.stat(filePath);

// 파일 크기 제한 재확인 (100MB)
if (fileStats.size > maxFileSize) {
  throw new Error(`File too large: ${Math.round(fileStats.size / 1024 / 1024)}MB`);
}

// 메타데이터 생성
const metadata = {
  filename,
  file_type: fileExt,
  file_size: fileStats.size,
  upload_date: fileStats.birthtime.toISOString(),
  processing_date: new Date().toISOString()
};
```

#### 3-2. 파일 형식별 텍스트 추출

**PDF 처리** (`processPDF()`)
```typescript
const dataBuffer = await fs.readFile(filePath);
const pdfData = await pdfParse(dataBuffer);

// 메타데이터 추출
const metadata = {
  total_pages: pdfData.numpages,
  title: pdfData.info?.Title,
  author: pdfData.info?.Author,
  subject: pdfData.info?.Subject
};

return {
  text: pdfData.text,  // 추출된 텍스트
  metadata
};
```

**DOCX 처리** (`processDOCX()`)
```typescript
const dataBuffer = await fs.readFile(filePath);
const result = await mammoth.extractRawText({ buffer: dataBuffer });

return {
  text: result.value,  // 추출된 텍스트
  metadata: {}
};
```

**TXT 처리** (`processTXT()`)
```typescript
return await fs.readFile(filePath, 'utf-8');
```

**XLSX 처리** (`processXLSX()`)
```typescript
const workbook = XLSX.readFile(filePath);
const textContent = [];

workbook.SheetNames.forEach((sheetName) => {
  const worksheet = workbook.Sheets[sheetName];
  const csvString = XLSX.utils.sheet_to_csv(worksheet);
  textContent.push(`Sheet: ${sheetName}\n${csvString}\n`);
});

return textContent.join('\n');
```

**CSV 처리** (`processCSV()`)
```typescript
const fileContent = await fs.readFile(filePath, 'utf-8');
const results = [];

// CSV를 파싱하여 텍스트로 변환
stream
  .pipe(csv())
  .on('data', (row) => {
    const rowText = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    results.push(rowText);
  })
  .on('end', () => {
    resolve(results.join('\n'));
  });
```

### 4단계: 텍스트 청크 분할
**위치**: `src/services/DocumentProcessor.ts` - `splitTextIntoChunks()` 메서드

#### 4-1. 청크 분할 전략
```typescript
const defaultChunkSize = 1000;  // 1000자
const defaultOverlap = 200;     // 200자 오버랩
```

**오버랩이 중요한 이유**:
- 문장이나 단락이 청크 경계에서 잘리는 것을 방지
- 연속성 있는 컨텍스트 유지
- 검색 정확도 향상

#### 4-2. 지능적 청크 분할
```typescript
function splitTextIntoChunks(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    
    // 단어 경계에서 자르기 (마지막 청크가 아닌 경우)
    if (end < text.length) {
      const lastSpaceIndex = text.lastIndexOf(' ', end);
      const lastNewlineIndex = text.lastIndexOf('\n', end);
      const lastPeriodIndex = text.lastIndexOf('.', end);
      
      // 가장 적절한 분할 지점 선택
      const bestCutPoint = Math.max(lastSpaceIndex, lastNewlineIndex, lastPeriodIndex);
      if (bestCutPoint > start + chunkSize * 0.5) {
        end = bestCutPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // 오버랩을 고려한 다음 시작점 계산
    start = Math.max(start + chunkSize - overlap, end);
  }

  return chunks;
}
```

**청크 분할 예시**:
```
원본 텍스트: "안녕하세요. 저는 김철수입니다. 회사에서 개발자로 일하고 있습니다. 취미는 독서입니다."

청크 1: "안녕하세요. 저는 김철수입니다. 회사에서 개발자로"
청크 2: "개발자로 일하고 있습니다. 취미는 독서입니다."
       ^^^^^^^^ (오버랩 부분)
```

#### 4-3. DocumentChunk 객체 생성
```typescript
const documentChunks = chunks.map((chunk, index) => ({
  id: this.generateChunkId(documentId, index),  // "doc_abc123_chunk_001"
  content: chunk,
  metadata: {
    source: filename,
    chunk_index: index,
    chunk_size: chunk.length,
    document_id: documentId,
    created_at: new Date().toISOString(),
    file_type: fileExt,
    // ... 기타 메타데이터
  }
}));
```

### 5단계: 임베딩 생성 (Dense Vector)
**위치**: `src/services/EmbeddingService.ts`

#### 5-1. Google Gemini를 통한 임베딩 생성
```typescript
async createEmbedding(text: string) {
  // 텍스트 길이 제한 확인 (10,000자)
  if (text.length > 10000) {
    throw new Error('Text too long for embedding');
  }

  // Google Generative AI 임베딩 모델 사용
  const embeddingModel = this.genAI.getGenerativeModel({ 
    model: 'embedding-001' 
  });
  
  const result = await embeddingModel.embedContent(text);
  const embedding = result.embedding.values;  // 768차원 벡터

  return {
    embedding,           // [0.1, 0.3, -0.2, ..., 0.5]
    model: 'embedding-001',
    tokens_used: Math.ceil(text.length / 4)  // 대략적 토큰 계산
  };
}
```

#### 5-2. 배치 임베딩 처리
```typescript
async createEmbeddingBatch(texts: string[]) {
  const batchSize = 5;  // 동시 요청 수 제한
  const batches = [];
  
  // 텍스트들을 5개씩 묶어서 처리
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const embeddings = [];
  for (const batch of batches) {
    const batchPromises = batch.map(text => this.createEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
  }

  return {
    embeddings,
    total_tokens: embeddings.reduce((sum, emb) => sum + emb.tokens_used, 0),
    processing_time: Date.now() - startTime
  };
}
```

### 6단계: 벡터 데이터베이스 저장
**위치**: `src/services/VectorService.ts` - `addDocuments()` 메서드

#### 6-1. Qdrant 컬렉션 확인 및 생성
```typescript
async ensureCollection() {
  const collections = await this.client.getCollections();
  const collectionExists = collections.collections.some(
    col => col.name === this.collectionName
  );

  if (!collectionExists) {
    // 컬렉션 생성
    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: 768,        // Gemini embedding 차원
        distance: 'Cosine' // 코사인 유사도 사용
      },
      optimizers_config: {
        default_segment_number: 2
      },
      replication_factor: 1
    });
  }
}
```

#### 6-2. 문서 청크들을 Qdrant에 저장
```typescript
async addDocuments(chunks: DocumentChunk[]) {
  const batchSize = 100;  // 한 번에 100개씩 처리
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    // 배치에 대해 임베딩 생성
    const texts = batch.map(chunk => chunk.content);
    const embeddingResult = await embeddingService.createEmbeddingBatch(texts);

    // Qdrant 포인트 형식으로 변환
    const points = batch.map((chunk, index) => ({
      id: chunk.id,                                    // "doc_abc123_chunk_001"
      vector: embeddingResult.embeddings[index].embedding,  // [0.1, 0.3, ...]
      payload: {
        content: chunk.content,                        // 원본 텍스트
        source: chunk.metadata.source,                 // 파일명
        chunk_index: chunk.metadata.chunk_index,       // 청크 인덱스
        document_id: chunk.metadata.document_id,       // 문서 ID
        file_type: chunk.metadata.file_type,          // 파일 형식
        created_at: chunk.metadata.created_at,         // 생성 시간
        // ... 기타 메타데이터
      }
    }));

    // Qdrant에 포인트들 저장
    await this.client.upsert(this.collectionName, {
      wait: true,
      points
    });
  }
}
```

## 📊 처리 상태 추적

### 진행률 업데이트
```typescript
async function processFileAsync(jobId, file) {
  const job = processingJobs.get(jobId);
  
  job.progress = 10;  // 처리 시작
  job.progress = 20;  // 텍스트 추출 완료
  job.progress = 50;  // 청크 분할 완료  
  job.progress = 80;  // 임베딩 생성 완료
  job.progress = 100; // 벡터 DB 저장 완료
}
```

### 상태 메시지
```typescript
function getStatusMessage(job) {
  switch (job.status) {
    case 'processing':
      if (job.progress < 30) return 'Parsing document content...';
      if (job.progress < 50) return 'Splitting text into chunks...';
      if (job.progress < 70) return 'Generating embeddings...';
      if (job.progress < 90) return 'Storing in vector database...';
      return 'Finalizing processing...';
    case 'completed':
      return `Successfully processed into ${job.chunks_created} chunks`;
    case 'failed':
      return job.error || 'Processing failed';
  }
}
```

## 🎯 처리 결과 예시

### 성공적인 처리 결과
```json
{
  "success": true,
  "document_id": "doc_abc123",
  "filename": "계약서.pdf",
  "file_type": "pdf",
  "total_chunks": 23,
  "processing_time": 15420,
  "chunks_created": [
    {
      "id": "doc_abc123_chunk_000",
      "content": "본 계약서는 갑과 을 사이의 서비스 제공 계약에 관한 내용을...",
      "metadata": {
        "source": "계약서.pdf",
        "chunk_index": 0,
        "document_id": "doc_abc123",
        "file_type": "pdf"
      }
    }
    // ... 더 많은 청크들
  ]
}
```

### 처리 시간 분석 (예시)
- **텍스트 추출**: 500-2000ms (파일 크기에 따라)
- **청크 분할**: 50-200ms  
- **임베딩 생성**: 3000-8000ms (청크 수에 따라)
- **벡터 DB 저장**: 1000-3000ms

**총 처리 시간**: 5-15초 (문서 크기와 복잡도에 따라)

## 🔧 임시 파일 정리

### 성공 시 정리
```typescript
if (processingResult.success) {
  // 처리 완료 후 임시 파일 삭제
  await documentProcessor.cleanupTempFile(file.path);
}
```

### 실패 시 정리
```typescript
catch (error) {
  // 실패 시에도 임시 파일 정리
  try {
    await documentProcessor.cleanupTempFile(file.path);
  } catch (cleanupError) {
    logger.warn('Failed to cleanup file after processing failure');
  }
}
```

이 문서 처리 파이프라인을 통해 다양한 형식의 문서가 검색 가능한 벡터 형태로 변환되어 RAG 시스템에서 활용됩니다.