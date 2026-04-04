import test from 'node:test';
import assert from 'node:assert/strict';
import deliverablesRoutes from '../src/modules/deliverables/deliverables.routes.js';
import { deliverablesService } from '../src/modules/deliverables/deliverables.service.js';
import {
  assertSuccessEnvelope,
  createAuthUser,
  createRouteTestApp,
  patchObjectMethods,
  requestJson,
} from './helpers/httpRouteTestUtils.js';

test('GET /deliverables envía filtros al servicio', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(deliverablesService, {
    listDeliverables: async (...args) => {
      receivedArgs = args;
      return [{ id: 'doc-1' }];
    },
  });
  try {
    const app = createRouteTestApp('/deliverables', deliverablesRoutes, {
      user: createAuthUser({ permissions: ['deliverables.read'] }),
    });
    const response = await requestJson(
      app,
      'GET',
      '/deliverables?projectId=project-1&status_code=issued&discipline_code=CIV&deliverable_type_code=RPT&search=rev',
    );
    assertSuccessEnvelope(response);
    assert.equal(receivedArgs?.[0], 'project-1');
    assert.deepEqual(receivedArgs?.[1], {
      status_code: 'issued',
      discipline_code: 'CIV',
      deliverable_type_code: 'RPT',
      search: 'rev',
    });
  } finally {
    restore();
  }
});

test('POST /deliverables crea un entregable con permiso deliverables.write', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(deliverablesService, {
    createDeliverable: async (...args) => {
      receivedArgs = args;
      return { id: 'doc-1', document_code: 'DOC-001' };
    },
  });
  try {
    const user = createAuthUser({ permissions: ['deliverables.write'] });
    const app = createRouteTestApp('/deliverables', deliverablesRoutes, { user });
    const payload = { project_id: 'project-1', document_code: 'DOC-001', title: 'General Report' };
    const response = await requestJson(app, 'POST', '/deliverables', payload);
    assertSuccessEnvelope(response, 201);
    assert.deepEqual(receivedArgs?.[0], payload);
    assert.equal(receivedArgs?.[1]?.user?.id, user.id);
  } finally {
    restore();
  }
});

test('POST /deliverables/:id/revisions rechaza cuando falta deliverables.manage_revisions', async () => {
  let called = false;
  const restore = patchObjectMethods(deliverablesService, {
    createRevision: async () => {
      called = true;
      return { id: 'rev-1' };
    },
  });
  try {
    const app = createRouteTestApp('/deliverables', deliverablesRoutes, {
      user: createAuthUser({ permissions: ['deliverables.write'] }),
    });
    const response = await requestJson(app, 'POST', '/deliverables/doc-1/revisions', { revision_code: 'A' });
    assert.equal(response.status, 403);
    assert.equal(response.json?.error, 'Forbidden');
    assert.equal(called, false);
  } finally {
    restore();
  }
});
