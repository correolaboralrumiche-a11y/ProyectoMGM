import test from 'node:test';
import assert from 'node:assert/strict';
import controlPeriodsRoutes from '../src/modules/controlPeriods/controlPeriods.routes.js';
import { controlPeriodsService } from '../src/modules/controlPeriods/controlPeriods.service.js';
import {
  assertSuccessEnvelope,
  createAuthUser,
  createRouteTestApp,
  patchObjectMethods,
  requestJson,
} from './helpers/httpRouteTestUtils.js';

test('GET /control-periods/definitions delega a listFinancialPeriods', async () => {
  let receivedProjectId = null;
  const restore = patchObjectMethods(controlPeriodsService, {
    listFinancialPeriods: async (projectId) => {
      receivedProjectId = projectId;
      return [{ id: 'fp-1', project_id: projectId }];
    },
  });
  try {
    const app = createRouteTestApp('/control-periods', controlPeriodsRoutes, {
      user: createAuthUser({ permissions: ['control_periods.read'] }),
    });
    const response = await requestJson(app, 'GET', '/control-periods/definitions?projectId=project-1');
    assertSuccessEnvelope(response);
    assert.equal(receivedProjectId, 'project-1');
  } finally {
    restore();
  }
});

test('POST /control-periods/capture delega a capturePeriod con auth y contexto', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(controlPeriodsService, {
    capturePeriod: async (...args) => {
      receivedArgs = args;
      return { id: 'period-1', financial_period_id: 'fp-1' };
    },
  });
  try {
    const user = createAuthUser({ permissions: ['control_periods.close'] });
    const app = createRouteTestApp('/control-periods', controlPeriodsRoutes, { user });
    const payload = { project_id: 'project-1', financial_period_id: 'fp-1' };
    const response = await requestJson(app, 'POST', '/control-periods/capture', payload);
    assertSuccessEnvelope(response, 201);
    assert.deepEqual(receivedArgs?.[0], payload);
    assert.equal(receivedArgs?.[1]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[2], { ip_address: '127.0.0.1', user_agent: 'node-test' });
  } finally {
    restore();
  }
});

test('DELETE /control-periods/definitions/:id rechaza sin permiso', async () => {
  let called = false;
  const restore = patchObjectMethods(controlPeriodsService, {
    deleteFinancialPeriod: async () => {
      called = true;
      return { id: 'fp-1' };
    },
  });
  try {
    const app = createRouteTestApp('/control-periods', controlPeriodsRoutes, {
      user: createAuthUser({ permissions: ['control_periods.read'] }),
    });
    const response = await requestJson(app, 'DELETE', '/control-periods/definitions/fp-1');
    assert.equal(response.status, 403);
    assert.equal(response.json?.error, 'Forbidden');
    assert.equal(called, false);
  } finally {
    restore();
  }
});
