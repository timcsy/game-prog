const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const result = spawnSync('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], { encoding: 'utf8' });
if (result.error || result.status !== 0) {
  console.error('Could not read the current main revision from origin.');
  process.exit(1);
}
const match = result.stdout.trim().match(/^([0-9a-f]{40,64})\s+refs\/heads\/main$/i);
const revision = process.env.GITHUB_SHA;
const output = process.env.GITHUB_OUTPUT;
if (!match || !/^[0-9a-f]{40,64}$/i.test(revision || '') || !output) {
  console.error('Missing or invalid main revision, workflow revision, or output path.');
  process.exit(1);
}
const current = match[1].toLowerCase() === revision.toLowerCase();
fs.appendFileSync(output, `current=${current}\n`);
console.log(current ? 'This commit is current; deployment may proceed.' : 'A newer main revision exists; skipping this deployment.');
