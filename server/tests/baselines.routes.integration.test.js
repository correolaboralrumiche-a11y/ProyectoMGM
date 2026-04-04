import test from 'node:test';
import assert from 'node:assert/strict';
import baselinesRoutes from '../src/modules/baselines/baselines.routes.js';
import { baselinesService } from '../src/modules/baselines/baselines.service.js';
import {
  assertSuccessEnvelope,
  createAuthUser,
  createRouteTestApp,
  patchObjectMethods,
  requestJson,
} from './helpers/httpRouteTestUtils.js';

test('GET /baselines delega a listBaselines con projectId', async () => {
  let receivedProjectId = null;
  const restore = patchObjectMethods(baselinesService, {
    listBaselines: async (projectId) => {
      receivedProjectId = projectId;
      return [{ id: 'bl-1' }];
    },
  });
  try {
    const app = createRouteTestApp('/baselines', baselinesRoutes, {
      user: createAuthUser({ permissions: ['baselines.read'] }),
    });
    const response = await requestJson(app, 'GET', '/baselines?projectId=project-1');
    assertSuccessEnvelope(response);
    assert.equal(receivedProjectId, 'project-1');
  } finally {
    restore();
  }
});

test('POST /baselines rechaza cuando falta permiso', async () => {
  let called = false;
  const restore = patchObjectMethods(baselinesService, {
    createBaseline: async () => {
      called = true;
      return { id: 'bl-1' };
    },
  });
  try {
    const app = createRouteTestApp('/baselines', baselinesRoutes, {
      user: createAuthUser({ permissions: [] }),
    });
    const response = await requestJson(app, 'POST', '/baselines', { project_id: 'project-1' });
    assert.equal(response.status, 403);
    assert.equal(response.json?.error, 'Forbidden');
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test('POST /baselines envía payload, auth y contexto a createBaseline', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(baselinesService, {
    createBaseline: async (...args) => {
      receivedArgs = args;
      return { id: 'bl-1', name: 'BL-01' };
    },
  });
  try {
    const user = createAuthUser({ permissions: ['baselines.create'] });
    const app = createRouteTestApp('/baselines', baselinesRoutes, { user });
    const payload = { project_id: 'project-1', name: 'BL-01' };
    const response = await requestJson(app, 'POST', '/baselines', payload);
    assertSuccessEnvelope(response, 201);
    assert.deepEqual(receivedArgs?.[0], payload);
    assert.equal(receivedArgs?.[1]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[2], { ip_address: '127.0.0.1', user_agent: 'node-test' });
  } finally {
    restore();
  }
});
