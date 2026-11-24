import './client.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suites = ['auth', 'social', 'travel', 'personal'];
const results = [];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${suite}.mjs`, import.meta.url))], { env: process.env, encoding: 'utf8', timeout: 120000 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) console.error(result.error.message);
  results.push({ suite, status: result.status === 0 ? 'PASS' : 'FAIL' });
}
console.log(JSON.stringify({ suites: results }));
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
