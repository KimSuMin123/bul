import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createVideoUploadMiddleware } from './src/server/videoUploader.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'video-upload-handler',
      configureServer(server) {
        server.middlewares.use(createVideoUploadMiddleware());
      }
    }
  ],
  server: {
    port: 3000,
    host: '127.0.0.1',
    open: false
  }
});
