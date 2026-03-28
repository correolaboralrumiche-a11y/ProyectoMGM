import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionToken, hashSessionToken } from '../src/utils/sessionToken.js';

test('createSessionToken returns a non-empty token', () => {
  const token = createSessionToken();

  assert.equal(typeof token, 'string');
  assert.ok(token.length >= 32);
});

test('hashSessionToken is deterministic for the same input', () => {
  const token = 'sample-session-token';

  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), hashSessionToken('different-token'));
});
