const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

test('only the current remote main commit is eligible for deployment', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'light-seed-deploy-'));
  const remote = path.join(root, 'remote.git');
  const checkout = path.join(root, 'checkout');
  const script = path.join(__dirname, '..', 'scripts', 'check-main.cjs');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(root, 'init', '--bare', remote);
    fs.mkdirSync(checkout);
    git(checkout, 'init');
    fs.writeFileSync(path.join(checkout, 'file.txt'), 'fixture');
    git(checkout, 'add', 'file.txt');
    git(checkout, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
    git(checkout, 'remote', 'add', 'origin', remote);
    git(checkout, 'push', 'origin', 'HEAD:refs/heads/main');
    const head = git(checkout, 'rev-parse', 'HEAD');

    function check(revision, name) {
      const output = path.join(root, name);
      const result = spawnSync(process.execPath, [script], {
        cwd: checkout, encoding: 'utf8',
        env: { ...process.env, GITHUB_SHA: revision, GITHUB_OUTPUT: output },
      });
      return { result, output };
    }
    const latest = check(head, 'latest-output');
    assert.equal(latest.result.status, 0);
    assert.equal(fs.readFileSync(latest.output, 'utf8'), 'current=true\n');
    const stale = check('0'.repeat(40), 'stale-output');
    assert.equal(stale.result.status, 0);
    assert.equal(fs.readFileSync(stale.output, 'utf8'), 'current=false\n');
    const invalid = check('invalid', 'invalid-output');
    assert.notEqual(invalid.result.status, 0);
    assert.equal(fs.existsSync(invalid.output), false);
    git(checkout, 'remote', 'remove', 'origin');
    const missing = check(head, 'missing-output');
    assert.notEqual(missing.result.status, 0);
    assert.equal(fs.existsSync(missing.output), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
