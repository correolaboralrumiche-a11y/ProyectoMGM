import test from 'node:test';
import assert from 'node:assert/strict';
import activitiesRoutes from '../src/modules/activities/activities.routes.js';
import { activitiesService } from '../src/modules/activities/activities.service.js';
import {
  assertSuccessEnvelope,
  createAuthUser,
  createRouteTestApp,
  patchObjectMethods,
  requestJson,
} from './helpers/httpRouteTestUtils.js';

test('POST /activities/:id/progress-updates delega a createProgressUpdate', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(activitiesService, {
    createProgressUpdate: async (...args) => {
      receivedArgs = args;
      return { id: 'pu-1', progress_percent: 35 };
    },
  });
  try {
    const user = createAuthUser({ permissions: ['activities.write'] });
    const app = createRouteTestApp('/activities', activitiesRoutes, { user });
    const payload = { progress_percent: 35, progress_date: '2026-04-04' };
    const response = await requestJson(app, 'POST', '/activities/activity-1/progress-updates', payload);
    assertSuccessEnvelope(response, 201);
    assert.equal(receivedArgs?.[0], 'activity-1');
    assert.deepEqual(receivedArgs?.[1], payload);
    assert.equal(receivedArgs?.[2]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[3], { ip_address: '127.0.0.1', user_agent: 'node-test' });
  } finally {
    restore();
  }
});

test('POST /activities/:id/actuals delega a createActualEntry', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(activitiesService, {
    createActualEntry: async (...args) => {
      receivedArgs = args;
      return { id: 'ac-1', actual_cost: 100 };
    },
  });
  try {
    const user = createAuthUser({ permissions: ['activities.write'] });
    const app = createRouteTestApp('/activities', activitiesRoutes, { user });
    const payload = { actual_cost: 100, actual_hours: 8 };
    const response = await requestJson(app, 'POST', '/activities/activity-1/actuals', payload);
    assertSuccessEnvelope(response, 201);
    assert.equal(receivedArgs?.[0], 'activity-1');
    assert.deepEqual(receivedArgs?.[1], payload);
  } finally {
    restore();
  }
});

test('DELETE /activities/:id rechaza sin permiso activities.delete', async () => {
  let called = false;
  const restore = patchObjectMethods(activitiesService, {
    deleteActivity: async () => {
      called = true;
      return { id: 'activity-1' };
    },
  });
  try {
    const app = createRouteTestApp('/activities', activitiesRoutes, {
      user: createAuthUser({ permissions: ['activities.write'] }),
    });
    const response = await requestJson(app, 'DELETE', '/activities/activity-1');
    assert.equal(response.status, 403);
    assert.equal(response.json?.error, 'Forbidden');
    assert.equal(called, false);
  } finally {
    restore();
  }
});
