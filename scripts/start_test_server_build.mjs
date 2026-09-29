// Isolated production-build server for e2e: the same `vite build` output as Netlify, served on 4310.
// Only the Supabase address differs (a test-only origin that the Playwright fixtures mock). Never reads .env.
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const outDir = 'test_artifacts/build-dist';
const shared = {
  configFile: false,
  envFile: false,
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:4310'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-only'),
    'import.meta.env.VITE_VIDEO_UPLOAD_MODE': JSON.stringify('direct'),
    // The isolated server blocks the internet, so the ffmpeg.wasm core is served from the build folder
    'import.meta.env.VITE_FFMPEG_CORE_BASE': JSON.stringify('/ffmpeg-core')
  },
  build: { outDir, emptyOutDir: true }
};

await build({ ...shared, mode: 'production', logLevel: 'warn' });
// fs.cpSync crashes on this Windows/OneDrive path, so copy the two core files one by one
mkdirSync(`${outDir}/ffmpeg-core`, { recursive: true });
for (const name of readdirSync('node_modules/@ffmpeg/core/dist/esm')) {
  copyFileSync(`node_modules/@ffmpeg/core/dist/esm/${name}`, `${outDir}/ffmpeg-core/${name}`);
}
const server = await preview({ ...shared, preview: { host: '127.0.0.1', port: 4310, strictPort: true, open: false } });
console.log('Isolated Playwright app (production build): http://127.0.0.1:4310');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await server.close(); process.exit(0); });
}
