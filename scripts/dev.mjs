import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import concurrently from 'concurrently';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const build = spawnSync('npm', ['run', 'build', '-w', '@resolve/contracts'], {
  cwd,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);
const { result } = concurrently(
  [
    { command: 'npm run dev -w @resolve/api', name: 'api', prefixColor: 'cyan' },
    { command: 'npm run dev -w @resolve/web', name: 'web', prefixColor: 'magenta' },
  ],
  { cwd, killOthersOn: ['failure', 'success'] },
);
await result.catch(() => {
  process.exitCode = 1;
});
