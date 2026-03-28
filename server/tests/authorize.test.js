import test from 'node:test';
import assert from 'node:assert/strict';

import { requirePermission } from '../src/middleware/authorize.js';

function createMockNext() {
  const calls = [];
  const next = (value) => calls.push(value ?? null);
  next.calls = calls;
  return next;
}

test('admin bypasses permission checks', () => {
  const middleware = requirePermission('projects.delete');
  const req = {
    auth: {
      user: {
        roles: ['admin'],
        permissions: [],
      },
    },
  };
  const next = createMockNext();

  middleware(req, {}, next);

  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0], null);
});

test('user with permission is allowed', () => {
  const middleware = requirePermission('projects.read');
  const req = {
    auth: {
      user: {
        roles: ['viewer'],
        permissions: ['projects.read'],
      },
    },
  };
  const next = createMockNext();

  middleware(req, {}, next);

  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0], null);
});

test('user without permission receives a forbidden error', () => {
  const middleware = requirePermission('projects.delete');
  const req = {
    auth: {
      user: {
        roles: ['viewer'],
        permissions: ['projects.read'],
      },
    },
  };
  const next = createMockNext();

  middleware(req, {}, next);

  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0]?.message, 'Forbidden');
  assert.equal(next.calls[0]?.status, 403);
});
