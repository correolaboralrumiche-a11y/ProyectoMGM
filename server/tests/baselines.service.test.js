import test from 'node:test';
import assert from 'node:assert/strict';
import { baselinesService } from '../src/modules/baselines/baselines.service.js';
import { baselinesRepository } from '../src/modules/baselines/baselines.repository.js';
import { patchObjectMethods, createAuthUser } from './helpers/httpRouteTestUtils.js';

function adminActor() {
  return { user: createAuthUser({ roles: ['admin'], permissions: [] }) };
}

test('baselinesService.listBaselines requiere projectId', async () => {
  await assert.rejects(() => baselinesService.listBaselines(''), {
    message: 'projectId is required',
  });
});

test('baselinesService.listBaselines falla si el proyecto no existe', async () => {
  const restore = patchObjectMethods(baselinesRepository, {
    findProjectById: async () => null,
  });
  try {
    await assert.rejects(() => baselinesService.listBaselines('project-1'), {
      message: 'Project not found',
    });
  } finally {
    restore();
  }
});

test('baselinesService.listBaselines devuelve baseline del proyecto cuando existe', async () => {
  const expected = [{ id: 'bl-1', name: 'BL-01' }];
  const restore = patchObjectMethods(baselinesRepository, {
    findProjectById: async () => ({ id: 'project-1', name: 'Proyecto Demo' }),
    listByProject: async () => expected,
  });
  try {
    const result = await baselinesService.listBaselines('project-1');
    assert.deepEqual(result, expected);
  } finally {
    restore();
  }
});

test('baselinesService.createBaseline requiere project_id', async () => {
  await assert.rejects(() => baselinesService.createBaseline({}, adminActor(), {}), {
    message: 'project_id is required',
  });
});

test('baselinesService.createBaseline falla si ya existe una baseline con el mismo nombre', async () => {
  const restore = patchObjectMethods(baselinesRepository, {
    findProjectById: async () => ({ id: 'project-1', name: 'Proyecto Demo', status_code: 'active' }),
    listByProject: async () => [],
    findBaselineByProjectAndName: async () => ({ id: 'bl-existing', name: 'BL-01' }),
  });
  try {
    await assert.rejects(
      () => baselinesService.createBaseline({ project_id: 'project-1', name: 'BL-01' }, adminActor(), {}),
      { message: 'A baseline with that name already exists for the project' },
    );
  } finally {
    restore();
  }
});

test('baselinesService.createBaseline falla si el proyecto no tiene WBS', async () => {
  const restore = patchObjectMethods(baselinesRepository, {
    findProjectById: async () => ({ id: 'project-1', name: 'Proyecto Demo', status_code: 'active' }),
    listByProject: async () => [],
    findBaselineByProjectAndName: async () => null,
    listProjectWbs: async () => [],
    listProjectActivities: async () => [],
  });
  try {
    await assert.rejects(
      () => baselinesService.createBaseline({ project_id: 'project-1', name: 'BL-01' }, adminActor(), {}),
      { message: 'Cannot create baseline for a project without WBS' },
    );
  } finally {
    restore();
  }
});

test('baselinesService.createBaseline falla si encuentra actividades huérfanas', async () => {
  const restore = patchObjectMethods(baselinesRepository, {
    findProjectById: async () => ({ id: 'project-1', name: 'Proyecto Demo', status_code: 'active' }),
    listByProject: async () => [],
    findBaselineByProjectAndName: async () => null,
    listProjectWbs: async () => [{ id: 'wbs-1', name: 'Root' }],
    listProjectActivities: async () => [{ id: 'act-1', wbs_id: 'missing-wbs' }],
  });
  try {
    await assert.rejects(
      () => baselinesService.createBaseline({ project_id: 'project-1', name: 'BL-01' }, adminActor(), {}),
      { message: 'Cannot create baseline with orphan activities' },
    );
  } finally {
    restore();
  }
});
