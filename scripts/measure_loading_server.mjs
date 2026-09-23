import { preview, build } from 'vite';
import react from '@vitejs/plugin-react';
const label = process.env.PERF_LABEL || 'after';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid PERF_LABEL');
const outDir = `test_artifacts/performance/${label}-dist`;
if (process.env.PERF_BUILD === '1') await build({ configFile: false, envFile: false, plugins: [react()], define: {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:4310'),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-only'),
  'import.meta.env.VITE_VIDEO_UPLOAD_MODE': JSON.stringify('direct')
}, build: { outDir, emptyOutDir: true } });
const server = await preview({ configFile: false, envFile: false, build: { outDir }, preview: { host: '127.0.0.1', port: 4310, strictPort: true, open: false } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.httpServer.close(() => process.exit(0)));
