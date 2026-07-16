import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    rolldownOptions: {}
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/upload': 'http://127.0.0.1:8000',
      '/chat': 'http://127.0.0.1:8000',
      '/history': 'http://127.0.0.1:8000',
      '/summary': 'http://127.0.0.1:8000',
      '/questions': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000'
    }
  }
})
