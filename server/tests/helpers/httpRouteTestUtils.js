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

function applySafeRequestContext(req) {
  req.requestId = 'test-request-id';

  try {
    Object.defineProperty(req, 'ip', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: '127.0.0.1',
    });
  } catch {
    // noop
  }

  try {
    if (req.socket) {
      Object.defineProperty(req.socket, 'remoteAddress', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: '127.0.0.1',
      });
    }
  } catch {
    // noop
  }

  const originalGet = typeof req.get === 'function' ? req.get.bind(req) : null;
  req.get = (name) => {
    if (typeof name === 'string' && name.toLowerCase() === 'user-agent') {
      return 'node-test';
    }
    return originalGet ? originalGet(name) : undefined;
  };
}

export function createRouteTestApp(basePath, route, { user } = {}) {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = { user: user || createAuthUser() };
    applySafeRequestContext(req);
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

  try {
    const headers = {
      'user-agent': 'node-test',
    };

    if (body) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
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

    return {
      status: response.status,
      text,
      json,
    };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
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
