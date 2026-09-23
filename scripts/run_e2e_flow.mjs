// Run actual browser assertions; preserve Playwright's non-zero failure status.
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit', env: process.env
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
