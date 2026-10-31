import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['dist/main.js'], { cwd: '/app/apps/api', stdio: 'inherit' }),
  spawn(process.execPath, ['dist/server/entry.mjs'], { cwd: '/app/apps/web', stdio: 'inherit' }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 10000);
  timer.unref();
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', () => {
    if (!stopping) stop(1);
  });
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(0));
