// 관리자 강의 영상 백그라운드 처리: 호환되지 않는 영상은 브라우저에서 변환(소리 유지)되고,
// 이미 호환 형식인 영상은 그대로 올라간 뒤 차시에 적용되는지 실제 관리자 화면으로 검증한다.
import { test, expect, login, admin, courseId } from './fixtures.mjs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const asset = name => fileURLToPath(new URL(`./assets/${name}`, import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));

function probe(buffer) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'upload-queue-')), 'uploaded.mp4');
  writeFileSync(file, buffer);
  const script = 'import sys,json;sys.path.insert(0,sys.argv[1]);import imageio_ffmpeg;from video_compat import probe;print(json.dumps(probe(imageio_ffmpeg.get_ffmpeg_exe(),sys.argv[2])))';
  return JSON.parse(execFileSync('python', ['-c', script, root, file]).toString());
}

function captureUploads(page) {
  const bodies = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/storage\/v1\/object\/lectures\//.test(request.url())) bodies.push(request.postDataBuffer());
  });
  return bodies;
}

test('an incompatible video is converted in the background, keeps its sound, and becomes a lecture', async ({ page, backend }) => {
  test.setTimeout(180000);
  const bodies = captureUploads(page);
  await login(page, admin.id);
  await page.getByRole('button', { name: '+ 신규 VOD 차시 등록', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ hasText: '신규 VOD 차시 등록 (CMS)' });
  await modal.locator('select').selectOption(courseId);
  await modal.getByPlaceholder('예: 4강. 보살행과 일상 속 자비 실천').fill('백그라운드 변환 검증');
  await modal.locator('input[type="file"]').setInputFiles(asset('needs-conversion.mp4'));
  await modal.getByRole('button', { name: '차시 등록 시작 (영상은 백그라운드 처리)', exact: true }).click();

  // The modal closes right away and the work moves to the panel
  await expect(page.getByRole('dialog')).toContainText('백그라운드 처리 시작');
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByText(/영상 처리 \(\d+\/1\)/)).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('차시 등록 완료', { timeout: 150000 });

  expect(bodies).toHaveLength(1);
  const result = probe(bodies[0]);
  expect(result).toMatchObject({ codec: 'h264', pix_fmt: 'yuv420p', sar: '1:1', fps: '30', audio: 'aac' });
  expect(result.level).toBeLessThanOrEqual(40);
  expect(['1920x1080', '1280x720']).toContain(result.size);
  expect(backend.db.lectures).toHaveLength(2);
  expect(backend.db.lectures[1].title).toBe('백그라운드 변환 검증');
  expect(backend.db.lectures[1].video_url).toContain('/storage/v1/object/lectures/');
  await expect(page.getByText('적용 완료', { exact: false })).toBeVisible();
});

test('an already compatible video skips conversion and replaces the lecture video in the background', async ({ page, backend }) => {
  test.setTimeout(120000);
  const bodies = captureUploads(page);
  await login(page, admin.id);
  await page.getByRole('button', { name: '강좌·VOD 관리', exact: true }).click();
  await page.getByRole('button', { name: '영상 교체' }).first().click();
  await page.locator('input[type="file"][accept*="video"]').last().setInputFiles(asset('already-compatible.mp4'));
  await page.getByRole('button', { name: '영상 교체 시작 (백그라운드 처리)', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('백그라운드 처리 시작');
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('영상 교체 완료', { timeout: 90000 });
  await expect(page.getByRole('dialog')).toContainText('이미 호환 형식');

  // The original File is streamed as-is (Playwright cannot read a File body, so the request count proves the upload)
  expect(bodies).toHaveLength(1);
  expect(backend.db.lectures[0].video_url).toContain('/storage/v1/object/lectures/');
});

test('an AVI recording (MJPEG + PCM) is converted with ffmpeg.wasm to 1080p Level 4.0 with sound and gets its duration', async ({ page, backend }) => {
  test.setTimeout(300000);
  const bodies = captureUploads(page);
  await login(page, admin.id);
  await page.getByRole('button', { name: '+ 신규 VOD 차시 등록', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ hasText: '신규 VOD 차시 등록 (CMS)' });
  await modal.locator('select').selectOption(courseId);
  // The PC converter (bat + ffmpeg.exe) is downloadable from the upload form
  const toolLink = modal.getByRole('link', { name: /변환 도구 내려받기/ });
  await expect(toolLink).toHaveAttribute('href', '/downloads/sba-video-converter.zip');
  const tool = await page.request.get('/downloads/sba-video-converter.zip');
  expect(tool.status()).toBe(200);
  expect((await tool.body()).length).toBeGreaterThan(20 * 1024 * 1024);
  await modal.locator('input[type="file"]').setInputFiles(asset('legacy-recording.avi'));
  // The browser cannot preview AVI, but the file is accepted and the title comes from the file name
  await expect(modal).toContainText('미리보기가 안 되지만 업로드할 수 있습니다');
  await expect(modal.getByPlaceholder('예: 4강. 보살행과 일상 속 자비 실천')).toHaveValue('legacy-recording');
  await modal.getByRole('button', { name: '차시 등록 시작 (영상은 백그라운드 처리)', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  const started = Date.now();
  const job = page.getByText(/신규 차시 · legacy-recording/).locator('..').locator('..');
  const ticker = setInterval(async () => {
    const text = await job.innerText().catch(() => '');
    console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  }, 10000);
  try {
    // Stop at the first result, success or failure, instead of waiting out the timeout
    await expect(page.getByRole('dialog')).toContainText(/차시 등록 (완료|실패)/, { timeout: 280000 });
  } finally {
    clearInterval(ticker);
  }
  await expect(page.getByRole('dialog')).toContainText('차시 등록 완료');
  console.log(`[AVI 변환+업로드 총 ${Math.round((Date.now() - started) / 1000)}초]`);

  expect(bodies).toHaveLength(1);
  const result = probe(bodies[0]);
  expect(result).toMatchObject({ codec: 'h264', pix_fmt: 'yuv420p', sar: '1:1', fps: '30', audio: 'aac', size: '1920x1080', level: 40 });
  const lecture = backend.db.lectures[1];
  expect(lecture.title).toBe('legacy-recording');
  expect(lecture.duration_seconds).toBe(3);
});
