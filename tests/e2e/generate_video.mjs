// Regenerate the tiny original browser video fixture without third-party media.
// MediaRecorder's streaming WebM omits Duration; add the known recording duration
// to Segment.Info so the actual HTMLVideoElement metadata path can read it.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const recorded = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 12000 });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    for (let frame = 0; frame < 12; frame++) {
      ctx.fillStyle = frame % 2 ? '#4b7355' : '#d49b4b';
      ctx.fillRect(0, 0, 64, 64);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
  });
  const bytes = Buffer.from(recorded);
  const infoPosition = bytes.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
  if (infoPosition < 0) throw new Error('WebM Segment.Info is missing');
  const sizePosition = infoPosition + 4;
  let sizeLength = 1;
  while (!(bytes[sizePosition] & (0x80 >> (sizeLength - 1)))) sizeLength++;
  let infoSize = bytes[sizePosition] & ((1 << (8 - sizeLength)) - 1);
  for (let i = 1; i < sizeLength; i++) infoSize = infoSize * 256 + bytes[sizePosition + i];
  const duration = Buffer.alloc(11);
  duration[0] = 0x44;
  duration[1] = 0x89;
  duration[2] = 0x88;
  duration.writeDoubleBE(1200, 3); // TimecodeScale is 1 ms in Chromium's WebM.
  const newSize = infoSize + duration.length;
  if (newSize >= 2 ** (7 * sizeLength) - 1) throw new Error('Fixture Info size grew beyond its EBML header');
  const sizeBytes = Buffer.alloc(sizeLength);
  let remaining = newSize;
  for (let i = sizeLength - 1; i >= 0; i--) { sizeBytes[i] = remaining % 256; remaining = Math.floor(remaining / 256); }
  sizeBytes[0] |= 0x80 >> (sizeLength - 1);
  const contentStart = sizePosition + sizeLength;
  const result = Buffer.concat([bytes.subarray(0, sizePosition), sizeBytes, bytes.subarray(contentStart, contentStart + infoSize), duration, bytes.subarray(contentStart + infoSize)]);
  const metadata = await page.evaluate(async encoded => {
    const blob = new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    try {
      return await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
        video.onerror = () => reject(new Error('Generated fixture could not be decoded'));
        video.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }, result.toString('base64'));
  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0 || metadata.width !== 64) throw new Error('Generated fixture metadata is invalid');
  mkdirSync(new URL('./assets/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./assets/short-video.webm', import.meta.url), result);
  console.log(`Generated ${result.length} bytes: ${metadata.duration}s, ${metadata.width}x${metadata.height}`);
} finally { await browser.close(); }
