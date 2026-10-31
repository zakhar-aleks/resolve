import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const path = new URL('../.env', import.meta.url);
let content;
try {
  content = await readFile(path, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  content = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
}
for (const name of ['RESOLVE_API_KEY', 'RESOLVE_REVIEWER_KEY']) {
  const pattern = new RegExp(`^${name}=(.*)$`, 'm');
  const existing = content.match(pattern);
  if (existing?.[1]?.trim()) continue;
  const line = `${name}=${randomBytes(32).toString('hex')}`;
  content = existing ? content.replace(pattern, line) : content + '\n' + line + '\n';
}
await writeFile(path, content, { mode: 0o600 });
await chmod(path, 0o600);
console.log(
  'Agent API credentials are stored in .env. Restart the API server. Read and use them locally; never put them in a browser or commit them.',
);
