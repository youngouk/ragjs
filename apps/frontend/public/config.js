/**
 * 런타임 설정 파일
 * 
 * 이 파일은 빌드 후에도 수정 가능한 런타임 설정을 제공합니다.
 * Railway 배포 시 환경변수 대신 이 파일을 직접 수정하여 API URL을 설정할 수 있습니다.
 * 
 * 우선순위:
 * 1. VITE_API_BASE_URL 환경변수 (빌드 시점)
 * 2. 이 파일의 API_BASE_URL (런타임)
 * 3. localhost:8000 (개발 폴백)
 */
window.RUNTIME_CONFIG = {
  // Railway 백엔드 서비스 URL을 여기에 설정하세요
  // 예: 'https://simple-rag-backend-production.up.railway.app'
  API_BASE_URL: '',
  
  // 환경 설정 (production, development, staging)
  NODE_ENV: 'production',
  
  // 추가 런타임 설정이 필요한 경우 여기에 추가
};