import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin-ws': {
        target: process.env.VITE_DEV_WS_BASE_URL || 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_DEV_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/stats': {
        target: process.env.VITE_DEV_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // console.log를 유지하여 디버깅
        drop_debugger: true,
      },
    },
    // CSS를 별도 파일로 추출
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@mui/material', '@mui/icons-material'],
  },
})
