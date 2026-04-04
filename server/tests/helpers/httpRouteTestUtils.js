import express from 'express';
import assert from 'node:assert/strict';

export function createAuthUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'tester',
    roles: ['planner'],
    permissions: [],
    ...overrides,
  };
}

export function createRouteTestApp(basePath, route, { user } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = { user: user || createAuthUser() };
    req.requestId = 'test-request-id';
    req.ip = '127.0.0.1';
    req.headers['user-agent'] = req.headers['user-agent'] || 'node-test';
    next();
  });
  app.use(basePath, route);
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });
  app.use((error, req, res, next) => {
    res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Internal server error',
      status: error?.status || 500,
    });
  });
  return app;
}

export async function requestJson(app, method, path, body) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}${path}`;
  try:
    const response = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: response.status, text, json };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

export function patchObjectMethods(target, patches) {
  const originals = new Map();
  for (const [key, value] of Object.entries(patches)) {
    originals.set(key, target[key]);
    target[key] = value;
  }
  return () => {
    for (const [key, value] of originals.entries()) {
      target[key] = value;
    }
  };
}

export function assertSuccessEnvelope(response, expectedStatus = 200) {
  assert.equal(response.status, expectedStatus);
  assert.equal(response.json?.success, true);
  assert.ok('data' in (response.json || {}));
}
