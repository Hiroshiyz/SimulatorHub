import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/ocpi': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
      '/simulator': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
    },
  },
})
