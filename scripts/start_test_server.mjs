// Isolated real-app server. Never read production .env or contact Supabase.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const server = await createServer({
  configFile: false,
  envFile: false,
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:4310'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-only'),
    'import.meta.env.VITE_VIDEO_UPLOAD_MODE': JSON.stringify('direct')
  },
  server: { host: '127.0.0.1', port: 4310, strictPort: true, open: false, hmr: false }
});
await server.listen();
console.log('Isolated Playwright app: http://127.0.0.1:4310');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await server.close(); process.exit(0); });
}
