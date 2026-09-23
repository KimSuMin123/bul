import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createVideoUploadMiddleware } from './src/server/videoUploader.js';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && mode === 'production') {
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(name => !env[name]?.trim());
    if (missing.length) throw new Error(`Production build requires ${missing.join(', ')}.`);
  }
  return {
  plugins: [
    react(),
    {
      name: 'video-upload-handler',
      configureServer(server) {
        if (env.VITE_VIDEO_UPLOAD_MODE === 'local') {
          server.middlewares.use(createVideoUploadMiddleware({
            supabaseUrl: env.VITE_SUPABASE_URL,
            anonKey: env.VITE_SUPABASE_ANON_KEY
          }));
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: '127.0.0.1',
    open: false
  }
  };
});
