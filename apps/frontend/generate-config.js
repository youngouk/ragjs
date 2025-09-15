#!/usr/bin/env node
// Railway에서 런타임 설정을 동적으로 생성하는 스크립트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway 환경 변수에서 URL 가져오기
const getAPIBaseURL = () => {
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  
  // Railway 환경에서 같은 서비스라면
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  return '';
};

const getWSBaseURL = () => {
  if (process.env.VITE_WS_BASE_URL) {
    return process.env.VITE_WS_BASE_URL;
  }
  
  if (process.env.WS_BASE_URL) {
    return process.env.WS_BASE_URL;
  }
  
  // Railway 환경에서 WebSocket URL 생성
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `wss://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  return '';
};

const config = {
  API_BASE_URL: getAPIBaseURL(),
  WS_BASE_URL: getWSBaseURL(),
  NODE_ENV: process.env.NODE_ENV || 'production',
  TIMESTAMP: new Date().toISOString(),
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || null,
};

// config.js 파일 생성
const configContent = `// Railway 런타임 설정 (자동 생성됨)
window.RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)};

console.log('🚀 Railway Runtime Config Loaded:', window.RUNTIME_CONFIG);`;

// public/config.js에 쓰기
const outputPath = path.join(__dirname, 'dist', 'config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ Runtime config generated:', outputPath);
console.log('📋 Config:', config);