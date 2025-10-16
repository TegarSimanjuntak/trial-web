// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        // rewrite /api/admin/documents -> /api/admin/documents  (kita keep /api on backend)
        // jika backend mount '/api' (sepertinya iya), JANGAN rewrite
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
