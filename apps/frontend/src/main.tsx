import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// 디버깅용 로그
console.log('🚀 React 앱 시작...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  console.log('✅ Root element found:', rootElement);
  
  const root = createRoot(rootElement);
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('✅ React 앱 렌더링 완료');
} catch (error) {
  console.error('❌ React 앱 렌더링 실패:', error);
  
  // 간단한 fallback HTML 표시
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: red;">React 앱 로드 실패</h1>
        <p>오류: ${error}</p>
        <p>F12를 눌러 개발자도구 콘솔을 확인하세요.</p>
        <button onclick="window.location.reload()">페이지 새로고침</button>
      </div>
    `;
  }
}
