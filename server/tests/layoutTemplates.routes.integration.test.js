import test from 'node:test';
import assert from 'node:assert/strict';
import layoutTemplatesRoutes from '../src/modules/layoutTemplates/layoutTemplates.routes.js';
import { layoutTemplatesService } from '../src/modules/layoutTemplates/layoutTemplates.service.js';
import {
  assertSuccessEnvelope,
  createAuthUser,
  createRouteTestApp,
  patchObjectMethods,
  requestJson,
} from './helpers/httpRouteTestUtils.js';

test('GET /layout-templates/meta/catalog devuelve el contrato base del catálogo', async () => {
  const restore = patchObjectMethods(layoutTemplatesService, {
    getCatalog: () => ({
      metrics: [{ value: 'ev', label: 'Earned Value' }],
      base_levels: [{ value: 'activity', label: 'Actividad' }],
      time_scales: [{ value: 'monthly', label: 'Mensual' }],
      general_columns: [{ value: 'code', label: 'Código' }],
    }),
  });

  try {
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, {
      user: createAuthUser({ permissions: ['layout_templates.read'] }),
    });

    const response = await requestJson(app, 'GET', '/layout-templates/meta/catalog');
    assertSuccessEnvelope(response);
    assert.ok(Array.isArray(response.json?.data?.metrics));
    assert.ok(Array.isArray(response.json?.data?.base_levels));
    assert.ok(Array.isArray(response.json?.data?.time_scales));
    assert.ok(Array.isArray(response.json?.data?.general_columns));
  } finally {
    restore();
  }
});

test('GET /layout-templates delega a listTemplates con projectId', async () => {
  let receivedProjectId = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    listTemplates: async (projectId) => {
      receivedProjectId = projectId;
      return [{ id: 'tpl-1', project_id: projectId }];
    },
  });

  try {
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, {
      user: createAuthUser({ permissions: ['layout_templates.read'] }),
    });

    const response = await requestJson(app, 'GET', '/layout-templates?projectId=project-1');
    assertSuccessEnvelope(response);
    assert.equal(receivedProjectId, 'project-1');
  } finally {
    restore();
  }
});

test('POST /layout-templates crea una plantilla con permiso layout_templates.create', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    createTemplate: async (...args) => {
      receivedArgs = args;
      return { id: 'tpl-1', name: 'Plantilla EV mensual' };
    },
  });

  try {
    const user = createAuthUser({ permissions: ['layout_templates.create'] });
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, { user });
    const payload = {
      project_id: 'project-1',
      name: 'Plantilla EV mensual',
      base_level: 'activity',
      time_metric: 'ev',
      time_mode: 'cumulative',
      time_scale: 'monthly',
      columns: ['code', 'name'],
    };

    const response = await requestJson(app, 'POST', '/layout-templates', payload);
    assertSuccessEnvelope(response, 201);
    assert.deepEqual(receivedArgs?.[0], payload);
    assert.equal(receivedArgs?.[1]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[2], {
      ip_address: '127.0.0.1',
      user_agent: 'node-test',
    });
  } finally {
    restore();
  }
});

test('GET /layout-templates/:id/preview-context delega a getPreviewContext', async () => {
  let receivedId = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    getPreviewContext: async (id) => {
      receivedId = id;
      return { project: { id: 'project-1' }, warnings: [] };
    },
  });

  try {
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, {
      user: createAuthUser({ permissions: ['layout_templates.read'] }),
    });

    const response = await requestJson(app, 'GET', '/layout-templates/tpl-1/preview-context');
    assertSuccessEnvelope(response);
    assert.equal(receivedId, 'tpl-1');
  } finally {
    restore();
  }
});

test('GET /layout-templates/:id/viewer-data delega a getViewerData', async () => {
  let receivedId = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    getViewerData: async (id) => {
      receivedId = id;
      return {
        columns: [{ key: 'code', label: 'Código' }],
        bucket_groups: [],
        buckets: [],
        rows: [],
      };
    },
  });

  try {
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, {
      user: createAuthUser({ permissions: ['layout_templates.read'] }),
    });

    const response = await requestJson(app, 'GET', '/layout-templates/tpl-1/viewer-data');
    assertSuccessEnvelope(response);
    assert.equal(receivedId, 'tpl-1');
  } finally {
    restore();
  }
});

test('PATCH /layout-templates/:id actualiza una plantilla con permiso layout_templates.update', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    updateTemplate: async (...args) => {
      receivedArgs = args;
      return { id: 'tpl-1', name: 'Plantilla EV semanal' };
    },
  });

  try {
    const user = createAuthUser({ permissions: ['layout_templates.update'] });
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, { user });
    const payload = { name: 'Plantilla EV semanal', time_scale: 'weekly' };

    const response = await requestJson(app, 'PATCH', '/layout-templates/tpl-1', payload);
    assertSuccessEnvelope(response);
    assert.equal(receivedArgs?.[0], 'tpl-1');
    assert.deepEqual(receivedArgs?.[1], payload);
    assert.equal(receivedArgs?.[2]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[3], {
      ip_address: '127.0.0.1',
      user_agent: 'node-test',
    });
  } finally {
    restore();
  }
});

test('DELETE /layout-templates/:id delega a deleteTemplate con permiso layout_templates.delete', async () => {
  let receivedArgs = null;
  const restore = patchObjectMethods(layoutTemplatesService, {
    deleteTemplate: async (...args) => {
      receivedArgs = args;
      return { id: 'tpl-1', deleted: true };
    },
  });

  try {
    const user = createAuthUser({ permissions: ['layout_templates.delete'] });
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, { user });

    const response = await requestJson(app, 'DELETE', '/layout-templates/tpl-1');
    assertSuccessEnvelope(response);
    assert.equal(receivedArgs?.[0], 'tpl-1');
    assert.equal(receivedArgs?.[1]?.user?.id, user.id);
    assert.deepEqual(receivedArgs?.[2], {
      ip_address: '127.0.0.1',
      user_agent: 'node-test',
    });
  } finally {
    restore();
  }
});

test('DELETE /layout-templates/:id rechaza sin permiso layout_templates.delete', async () => {
  let called = false;
  const restore = patchObjectMethods(layoutTemplatesService, {
    deleteTemplate: async () => {
      called = true;
      return { id: 'tpl-1', deleted: true };
    },
  });

  try {
    const app = createRouteTestApp('/layout-templates', layoutTemplatesRoutes, {
      user: createAuthUser({ permissions: ['layout_templates.read'] }),
    });

    const response = await requestJson(app, 'DELETE', '/layout-templates/tpl-1');
    assert.equal(response.status, 403);
    assert.equal(response.json?.error, 'Forbidden');
    assert.equal(called, false);
  } finally {
    restore();
  }
});
