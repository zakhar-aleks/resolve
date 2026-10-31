import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = resolve(root, '.runtime');
const data = resolve(runtime, 'postgres');
const socket = `/private/tmp/resolve-pg-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`;
function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: 'resolve' },
  });
  if (result.error || result.status !== 0) {
    if (allowFailure) return false;
    throw new Error(
      `${command} failed. Run this command in your terminal if the host sandbox blocks PostgreSQL shared memory.`,
    );
  }
  return true;
}
mkdirSync(runtime, { recursive: true });
if (process.argv[2] === 'stop') {
  if (existsSync(data)) run('pg_ctl', ['-D', data, 'stop', '-m', 'fast'], true);
} else {
  mkdirSync(socket, { recursive: true });
  if (!existsSync(resolve(data, 'PG_VERSION'))) {
    const passwordFile = resolve(runtime, 'database-password');
    writeFileSync(passwordFile, 'resolve\n', { mode: 0o600 });
    run('initdb', [
      '-D',
      data,
      '-U',
      'resolve',
      '--auth-local=trust',
      '--auth-host=scram-sha-256',
      '--pwfile',
      passwordFile,
      '--no-locale',
      '--encoding=UTF8',
    ]);
  }
  const running = spawnSync('pg_ctl', ['-D', data, 'status'], { stdio: 'ignore' }).status === 0;
  if (!running)
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      resolve(runtime, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p 55432 -k ${socket}`,
      '-w',
      'start',
    ]);
  const exists = spawnSync(
    'psql',
    [
      '-h',
      '127.0.0.1',
      '-p',
      '55432',
      '-U',
      'resolve',
      '-d',
      'postgres',
      '-Atc',
      "SELECT 1 FROM pg_database WHERE datname='resolve'",
    ],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: 'resolve' } },
  );
  if (exists.status !== 0) throw new Error('Unable to inspect the project database.');
  if (!exists.stdout.trim())
    run('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'resolve', 'resolve']);
  console.log('PostgreSQL ready on 127.0.0.1:55432. Use npm run dev.');
}
