import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeRegulationId, isPrivateAddress, parseRemoteUrl } from '../server/security.js';
import { writeJsonAtomic } from '../server/json-store.js';

test('regulation ids allow repository ids and reject path traversal', () => {
  assert.equal(assertSafeRegulationId('药物警戒质量管理规范'), '药物警戒质量管理规范');
  assert.equal(assertSafeRegulationId('GVP-Module-VI_2026'), 'GVP-Module-VI_2026');
  for (const value of ['../state/users', '..', 'a/b', 'a\\b', '', '.']) {
    assert.throws(() => assertSafeRegulationId(value), /法规 ID 格式不合法/);
  }
});

test('all packaged regulation filenames satisfy the id policy', () => {
  const directory = path.resolve('data/regulations');
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.json'))) {
    const id = filename.slice(0, -5);
    assert.equal(assertSafeRegulationId(id), id, filename);
  }
});

test('private and reserved IP addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.2', '169.254.169.254', '::1', '::ffff:7f00:1', 'fd00::1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('remote URLs reject unsafe protocols, credentials and literal private hosts', () => {
  assert.equal(parseRemoteUrl('https://example.com/path').hostname, 'example.com');
  for (const value of [
    'file:///etc/passwd',
    'http://localhost/admin',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://[::ffff:7f00:1]/',
    'https://user:pass@example.com/',
  ]) {
    assert.throws(() => parseRemoteUrl(value));
  }
});

test('atomic JSON writer replaces a valid document and leaves no temp file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvqa-json-'));
  const file = path.join(dir, 'state.json');
  try {
    writeJsonAtomic(file, { ok: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf-8')), { ok: true });
    assert.deepEqual(fs.readdirSync(dir), ['state.json']);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
