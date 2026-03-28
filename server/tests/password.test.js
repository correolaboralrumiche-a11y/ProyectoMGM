import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../src/utils/password.js';

test('hashPassword produces a PBKDF2 hash', () => {
  const hash = hashPassword('Secret123!');

  assert.equal(typeof hash, 'string');
  assert.ok(hash.startsWith('pbkdf2_sha512$'));
});

test('verifyPassword accepts the correct password and rejects the wrong one', () => {
  const hash = hashPassword('Secret123!');

  assert.equal(verifyPassword('Secret123!', hash), true);
  assert.equal(verifyPassword('WrongPassword', hash), false);
});
