// Browser regression tests for the real CourseProvider, with an isolated in-memory API.
// No application environment variables or external services are used.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const apiFixture = `
export const isExternalDbConfigured = true;
export const deleteLectureVideo = async () => {};
export const getLectureVideoUrl = async value => value;
export const getThumbnailUrl = async value => value;
const names = ['Courses','Lectures','Enrollments','Payments','Progress','Certificates','QAPosts','ExamAttempts'];
window.fixture = { data: {}, calls: [], fail: {}, holds: {} };
export const remoteDb = {};
for (const name of names) {
  window.fixture.data[name] = [];
  remoteDb['get' + name] = async (...args) => {
    const f = window.fixture;
    f.calls.push(['get' + name, ...args]);
    if (f.fail['get' + name]) throw new Error('조회 실패');
    const result = structuredClone(f.data[name]);
    if (f.holds['get' + name]) await new Promise(resolve => f.holds['get' + name].push(resolve));
    return result;
  };
}
for (const name of ['upsertEnrollment','upsertProgress','insertCertificate','insertPayment','processCoursePayment']) {
  remoteDb[name] = async (value) => {
    const f = window.fixture;
    f.calls.push([name, value]);
    if (f.fail[name]) throw new Error('저장 실패');
    if (f.holds[name]) await new Promise(resolve => f.holds[name].push(resolve));
    if (name === 'processCoursePayment') return { paymentId: 'pay-server', expireAt: '2027-01-01' };
    if (name === 'upsertProgress') return { ...value, id:'progress-server', userId:'student-a', progressRate:value.lastPlayedSeconds, completed:value.lastPlayedSeconds >= 100 };
    if (name === 'insertCertificate') return { ...value, certNo:'cert-server', userId:'student-a' };
    return value;
  };
}
remoteDb.submitCourseExam = async (attemptId, answers) => {
  const f = window.fixture;
  f.calls.push(['submitCourseExam', attemptId, answers]);
  if (f.fail.submitCourseExam) throw new Error('시험 저장 실패');
  const result = { id:attemptId,userId:'student-a',courseId:'c1',score:100,passed:true,correctCount:1,totalCount:1 };
  f.data.ExamAttempts = [result];
  return result;
};
remoteDb.startCourseExam = async courseId => ({attemptId:'attempt-server',questions:[{id:1,question:'Server question',options:['A','B']}]});
remoteDb.getCourseExam = async courseId => (window.fixture.examBank || {questions:[],rawExamText:null});
`;
const authFixture = `
import React from 'react';
const Auth = React.createContext(null);
export function TestAuth({children}) {
  const [currentUser, setUser] = React.useState({ id: 'student-a', role: 'student' });
  window.setTestUser = setUser;
  return React.createElement(Auth.Provider, {value: {currentUser, isAdmin: currentUser?.role === 'admin'}}, children);
}
export const useAuth = () => React.useContext(Auth);
`;
const bundle = await build({
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {CourseProvider, useCourse} from './src/context/CourseContext.jsx';
      import {TestAuth} from './src/context/AuthContext.jsx';
      import {ModalAlertProvider, useModalAlert} from './src/context/ModalAlertContext.jsx';
      import VideoPlayer from './src/components/player/VideoPlayer.jsx';
      function Probe() { window.course = useCourse(); return <div>Course state regression harness</div>; }
      function ModalProbe() {
        const {showConfirm} = useModalAlert();
        return <button id="open-confirm" onClick={async () => { window.confirmResult = await showConfirm('Continue?', {confirmText:'Confirm',cancelText:'Cancel'}); }}>Open</button>;
      }
      createRoot(document.getElementById('root')).render(<ModalAlertProvider><TestAuth><CourseProvider><Probe /><ModalProbe /><VideoPlayer lecture={{id:'l1',durationSeconds:100}} userId="student-a" onEnded={() => { window.videoEnded = true; }} /></CourseProvider></TestAuth></ModalAlertProvider>);`,
    loader: 'jsx', resolveDir: process.cwd()
  },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  plugins: [{ name: 'isolated-fixtures', setup(b) {
    b.onResolve({filter: /(?:apiClient|mediaStorage|AuthContext|notificationService)(?:\.jsx?)?$/}, args => ({path: args.path.split('/').pop().replace(/\.jsx?$/, ''), namespace: 'fixture'}));
    b.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({
      contents: args.path.includes('apiClient') ? apiFixture : args.path.includes('AuthContext') ? authFixture : args.path.includes('mediaStorage') ? 'export const getLectureVideoUrl = async value => value;' : 'export const notifyAdminCourseApplication = async () => {};',
      loader: 'js', resolveDir: process.cwd()
    }));
  }}]
});
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);
let browser;
let failed = 0;
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-background-networking'] });
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.setDefaultTimeout(5000);
  await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort('blockedbyclient'));
  const reset = async () => {
    await page.goto(url);
    await page.waitForFunction(() => window.course && !window.course.loading);
  };
  const flush = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  const check = async (name, fn) => {
    try { await reset(); await fn(); console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.message); }
  };
  await check('successful empty course response stays empty', async () => {
    assert.equal(await page.evaluate(() => course.courses.length), 0);
  });
  await check('refresh removes server-deleted records, including empty results', async () => {
    await page.evaluate(async () => {
      fixture.data.Enrollments = [{id:'e1', userId:'student-a', courseId:'c1'}];
      fixture.data.Progress = [{id:'p1', userId:'student-a'}];
      await course.refreshData();
    });
    await flush();
    await page.evaluate(async () => { fixture.data.Enrollments = []; fixture.data.Progress = []; await course.refreshData(); });
    await flush();
    assert.deepEqual(await page.evaluate(() => [course.enrollments.length, course.progressList.length]), [0, 0]);
  });
  await check('logout clears private state', async () => {
    await page.evaluate(async () => { fixture.data.Certificates = [{id:'cert1', userId:'student-a'}]; await course.refreshData(); });
    await flush();
    await page.evaluate(() => setTestUser(null));
    await flush();
    assert.equal(await page.evaluate(() => course.certificates.length), 0);
  });
  await check('administrator answer bank disappears while the next identity catalog is loading', async () => {
    await page.evaluate(() => {
      fixture.data.Courses = [{id:'c1',title:'Private question bank course'}];
      fixture.examBank = {questions:[],rawExamText:'Administrator-only answer bank'};
      setTestUser({id:'admin-a',role:'admin'});
    });
    await page.waitForFunction(() => course.courses[0]?.rawExamText === 'Administrator-only answer bank');
    await page.evaluate(() => { fixture.holds.getCourses = []; setTestUser(null); });
    await page.waitForFunction(() => fixture.holds.getCourses.length > 0);
    assert.equal(await page.evaluate(() => course.courses.length), 0);
    await page.evaluate(() => fixture.holds.getCourses.forEach(release => release()));
    await page.waitForFunction(() => !course.loading);
    assert.equal(await page.evaluate(() => course.courses.some(item => item.rawExamText?.includes('Administrator-only'))), false);
  });
  await check('expired paid enrollment cannot grant course access', async () => {
    await page.evaluate(async () => {
      fixture.data.Enrollments = [{id:'e-expired',userId:'student-a',courseId:'c1',status:'active',expireAt:'2000-01-01'}];
      await course.refreshData();
    });
    await flush();
    assert.equal(await page.evaluate(() => course.hasCourseAccess('student-a','c1')), false);
  });
  await check('sequential access waits for complete progress, including the 95 percent boundary', async () => {
    await page.evaluate(async () => {
      fixture.data.Courses = [{id:'c1',sequentialUnlock:true}];
      fixture.data.Lectures = [{id:'l1',courseId:'c1',orderIndex:1},{id:'l2',courseId:'c1',orderIndex:2}];
      fixture.data.Progress = [{userId:'student-a',lectureId:'l1',progressRate:95,completed:false}];
      await course.refreshData();
    });
    await flush();
    assert.equal(await page.evaluate(() => course.isLectureLocked('student-a','l2')), true);
    await page.evaluate(async () => { fixture.data.Progress[0].progressRate = 100; fixture.data.Progress[0].completed = true; await course.refreshData(); });
    await flush();
    assert.equal(await page.evaluate(() => course.isLectureLocked('student-a','l2')), false);
  });
  await check('old account response cannot overwrite new account state', async () => {
    await page.evaluate(() => {
      fixture.data.Progress = [{id:'old', userId:'student-a'}]; fixture.holds.getProgress = [];
      window.pendingRefresh = course.refreshData();
    });
    await page.waitForFunction(() => fixture.holds.getProgress.length === 1);
    await page.evaluate(() => {
      window.releaseOld = fixture.holds.getProgress[0]; delete fixture.holds.getProgress;
      fixture.data.Progress = []; setTestUser({id:'student-b', role:'student'});
    });
    await flush();
    await page.evaluate(async () => { releaseOld(); await pendingRefresh; });
    await flush();
    assert.equal(await page.evaluate(() => course.progressList.length), 0);
  });
  await check('failed enrollment does not report success or change state', async () => {
    const rejected = await page.evaluate(async () => {
      fixture.fail.upsertEnrollment = true;
      try { await course.enrollStudent('student-a', 'c1', 'pending'); return false; } catch { return true; }
    });
    await flush();
    assert.equal(rejected, true);
    assert.equal(await page.evaluate(() => course.enrollments.length), 0);
  });
  await check('progress save does not reload unrelated resources', async () => {
    await page.evaluate(async () => { fixture.calls = []; await course.updateProgress('student-a','l1',5,100); });
    await flush();
    assert.equal(await page.evaluate(() => fixture.calls.filter(([name]) => name.startsWith('get')).length), 0);
  });
  await check('fractional playback position reaches the server without rounding', async () => {
    await page.evaluate(async () => { fixture.calls = []; await course.updateProgress('student-a','l1',7.5,100); });
    assert.equal(await page.evaluate(() => fixture.calls.find(([name]) => name === 'upsertProgress')[1].lastPlayedSeconds), 7.5);
  });
  await check('failed progress stays unsaved', async () => {
    const rejected = await page.evaluate(async () => {
      fixture.fail.upsertProgress = true;
      try { await course.updateProgress('student-a','l1',100,100); return false; } catch { return true; }
    });
    await flush();
    assert.equal(rejected, true);
    assert.equal(await page.evaluate(() => course.progressList.length), 0);
  });
  await check('failed payment never starts sequential fallback or changes the ledger', async () => {
    const rejected = await page.evaluate(async () => {
      fixture.fail.processCoursePayment = true; fixture.calls = [];
      try { await course.recordPayment({userId:'student-a',courseId:'c1',amount:100,manager:'staff',methodMemo:'cash'}); return false; } catch { return true; }
    });
    await flush();
    assert.equal(rejected, true);
    assert.equal(await page.evaluate(() => course.payments.length), 0);
    assert.equal(await page.evaluate(() => fixture.calls.some(([name]) => ['insertPayment','upsertEnrollment'].includes(name))), false);
  });
  await check('sync message preserves its transport type and change reason', async () => {
    await page.evaluate(() => {
      window.messageReceived = null;
      window.observer = new BroadcastChannel('buddha_course_sync_channel');
      observer.onmessage = event => { window.messageReceived = event.data; };
    });
    await page.evaluate(() => course.enrollStudent('student-a','c1','pending'));
    await page.waitForFunction(() => messageReceived !== null);
    assert.deepEqual(await page.evaluate(() => [messageReceived.type, messageReceived.reason]), ['COURSE_SYNC_REFRESH','ENROLLMENT_UPDATED']);
  });
  await check('failed refresh preserves confirmed data and exposes an error', async () => {
    await page.evaluate(async () => { fixture.data.Progress = [{id:'saved'}]; await course.refreshData(); });
    await flush();
    await page.evaluate(async () => { fixture.fail.getProgress = true; await course.refreshData(); });
    await flush();
    assert.equal(await page.evaluate(() => course.progressList[0]?.id), 'saved');
    assert.equal(await page.evaluate(() => Boolean(course.error)), true);
  });
  await check('remote progress sync only fetches progress', async () => {
    await page.evaluate(() => {
      fixture.calls = []; fixture.data.Progress = [{id:'remote'}];
      const sender = new BroadcastChannel('buddha_course_sync_channel');
      sender.postMessage({type:'COURSE_SYNC_REFRESH',reason:'PROGRESS_UPDATED',userId:'student-a',source:'other-tab'}); sender.close();
    });
    await page.waitForFunction(() => course.progressList[0]?.id === 'remote');
    assert.deepEqual(await page.evaluate(() => fixture.calls.map(([name]) => name)), ['getProgress']);
  });
  await check('exam result save failure never becomes a saved attempt', async () => {
    const rejected = await page.evaluate(async () => {
      fixture.fail.submitCourseExam = true;
      try { await course.submitExam('student-a','c1','attempt-server',{1:1}); return false; } catch { return true; }
    });
    await flush();
    assert.equal(rejected, true);
    assert.equal(await page.evaluate(() => course.examAttempts.length), 0);
  });
  await check('failed follow-up refresh preserves the server-scored exam result', async () => {
    await page.evaluate(async () => {
      fixture.data.Courses = [{id:'c1'}]; fixture.data.Lectures = [{id:'l1',courseId:'c1'}];
      fixture.data.Progress = [{userId:'student-a',lectureId:'l1',completed:true,progressRate:100}];
      fixture.data.Enrollments = [{id:'e1',userId:'student-a',courseId:'c1',status:'active'}];
      await course.refreshData();
    });
    await flush();
    const passed = await page.evaluate(async () => {
      fixture.fail.getEnrollments = true;
      return (await course.submitExam('student-a','c1','attempt-server',{1:1})).passed;
    });
    await flush();
    assert.equal(passed, true);
    assert.equal(await page.evaluate(() => course.examAttempts.length), 1);
    assert.equal(await page.evaluate(() => course.enrollments[0].status), 'active');
    assert.equal(await page.evaluate(() => Boolean(course.error)), true);
    assert.equal(await page.evaluate(() => fixture.calls.some(([name]) => name === 'upsertEnrollment')), false);
  });
  await check('certificate save failure never adds a local certificate', async () => {
    await page.evaluate(async () => {
      fixture.data.Courses = [{id:'c1',title:'Course'}]; fixture.data.Lectures = [{id:'l1',courseId:'c1'}];
      fixture.data.Progress = [{userId:'student-a',lectureId:'l1',completed:true,progressRate:100}];
      fixture.data.ExamAttempts = [{userId:'student-a',courseId:'c1',passed:true}]; await course.refreshData();
    });
    await flush();
    const rejected = await page.evaluate(async () => {
      fixture.fail.insertCertificate = true;
      try { await course.claimCertificate('c1'); return false; } catch { return true; }
    });
    await flush();
    assert.equal(rejected, true);
    assert.equal(await page.evaluate(() => course.certificates.length), 0);
    assert.equal(await page.evaluate(() => fixture.calls.some(([name]) => name === 'insertCertificate')), true);
  });
  await check('Enter on Cancel cancels and restores the original focus', async () => {
    await page.click('#open-confirm');
    await page.waitForSelector('.alert-btn-cancel');
    await page.waitForFunction(() => document.activeElement?.classList.contains('alert-btn-confirm'));
    await page.focus('.alert-btn-cancel');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.confirmResult === false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-confirm');
  });
  await check('modal traps Tab and uses the current reopened dialog callback', async () => {
    await page.click('#open-confirm');
    await page.waitForFunction(() => document.activeElement?.classList.contains('alert-btn-confirm'));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('.alert-modal-card'))), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.confirmResult === false);
    await page.click('#open-confirm');
    await page.waitForFunction(() => document.activeElement?.classList.contains('alert-btn-confirm'));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.confirmResult === true);
  });
  await check('video completion waits for persistence and allows retry after failure', async () => {
    await page.evaluate(() => { fixture.fail.upsertProgress = true; document.querySelector('video').dispatchEvent(new Event('ended')); });
    await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('진도를 저장하지 못했습니다'));
    assert.equal(await page.evaluate(() => Boolean(window.videoEnded)), false);
    assert.equal(await page.$('.player-complete-banner'), null);
    await page.evaluate(() => { fixture.fail.upsertProgress = false; document.querySelector('video').dispatchEvent(new Event('ended')); });
    await page.waitForFunction(() => window.videoEnded === true);
    assert.equal(await page.evaluate(() => course.progressList[0]?.completed), true);
  });
  await check('partial catalog failure preserves the last complete catalog', async () => {
    await page.evaluate(async () => { fixture.data.Courses = [{id:'c1',title:'Confirmed'}]; fixture.data.Lectures = [{id:'l1',courseId:'c1'}]; await course.refreshData(); });
    await flush();
    await page.evaluate(async () => { fixture.data.Courses = [{id:'c1',title:'Unconfirmed'}]; fixture.fail.getLectures = true; await course.refreshData(); });
    await flush();
    assert.equal(await page.evaluate(() => course.courses[0].title), 'Confirmed');
    assert.deepEqual(await page.evaluate(() => course.courses[0].lectureIds), ['l1']);
  });
  await check('older progress sync response cannot overwrite a newer response', async () => {
    await page.evaluate(() => {
      fixture.holds.getProgress = []; fixture.data.Progress = [{id:'old'}];
      window.sendSync = () => { const ch = new BroadcastChannel('buddha_course_sync_channel'); ch.postMessage({type:'COURSE_SYNC_REFRESH',reason:'PROGRESS_UPDATED',userId:'student-a',source:'other'}); ch.close(); };
      sendSync();
    });
    await page.waitForFunction(() => fixture.holds.getProgress.length === 1);
    await page.evaluate(() => { fixture.data.Progress = [{id:'new'}]; sendSync(); });
    await page.waitForFunction(() => fixture.holds.getProgress.length === 2);
    await page.evaluate(() => fixture.holds.getProgress[1]());
    await page.waitForFunction(() => course.progressList[0]?.id === 'new');
    await page.evaluate(() => fixture.holds.getProgress[0]());
    await flush();
    assert.equal(await page.evaluate(() => course.progressList[0].id), 'new');
  });
  await check('payment follow-up query cannot overwrite a newer refresh', async () => {
    await page.evaluate(() => {
      fixture.data.Enrollments = [{id:'old',userId:'student-a'}]; fixture.holds.getEnrollments = [];
      window.pendingPayment = course.recordPayment({userId:'student-a',courseId:'c1',amount:100,manager:'staff',methodMemo:'cash'});
    });
    await page.waitForFunction(() => fixture.holds.getEnrollments.length === 1);
    await page.evaluate(async () => {
      window.releaseEnrollment = fixture.holds.getEnrollments[0]; delete fixture.holds.getEnrollments;
      fixture.data.Enrollments = [{id:'new',userId:'student-a'}]; await course.refreshData();
    });
    await flush();
    await page.evaluate(async () => { releaseEnrollment(); await pendingPayment; });
    await flush();
    assert.equal(await page.evaluate(() => course.enrollments[0].id), 'new');
  });
  await check('video completion is saved after the pending periodic write', async () => {
    await page.evaluate(() => {
      fixture.holds.upsertProgress = [];
      const video = document.querySelector('video');
      Object.defineProperties(video, {paused:{value:false},currentTime:{value:5},duration:{value:100}});
      video.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForFunction(() => fixture.holds.upsertProgress.length === 1);
    await page.evaluate(() => document.querySelector('video').dispatchEvent(new Event('ended')));
    await flush();
    assert.equal(await page.evaluate(() => fixture.calls.filter(([name]) => name === 'upsertProgress').length), 1);
    await page.evaluate(() => { const release = fixture.holds.upsertProgress[0]; delete fixture.holds.upsertProgress; release(); });
    await page.waitForFunction(() => window.videoEnded === true);
    assert.deepEqual(await page.evaluate(() => fixture.calls.filter(([name]) => name === 'upsertProgress').map(([,row]) => row.lastPlayedSeconds)), [5,100]);
    assert.equal(await page.evaluate(() => course.progressList[0].completed), true);
  });
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failed) process.exitCode = 1;
