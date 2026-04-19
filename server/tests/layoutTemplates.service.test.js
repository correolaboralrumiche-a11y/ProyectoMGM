import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutTemplatesService } from '../src/modules/layoutTemplates/layoutTemplates.service.js';
import { createAuthUser } from './helpers/httpRouteTestUtils.js';

function plannerActor() {
  return {
    user: createAuthUser({
      permissions: [
        'layout_templates.read',
        'layout_templates.create',
        'layout_templates.update',
        'layout_templates.delete',
      ],
    }),
  };
}

test('layoutTemplatesService.getCatalog devuelve un contrato técnico consistente', () => {
  const catalog = layoutTemplatesService.getCatalog();

  assert.ok(catalog);
  assert.ok(Array.isArray(catalog.base_levels));
  assert.ok(Array.isArray(catalog.time_scales));
  assert.ok(Array.isArray(catalog.general_columns));
  assert.ok(Array.isArray(catalog.metrics));

  assert.ok(catalog.general_columns.some((column) => column?.key === 'name'));
  assert.ok(catalog.general_columns.some((column) => column?.key === 'baseline_cost'));
  assert.ok(catalog.general_columns.some((column) => column?.key === 'ev_amount'));

  const progressMetric = catalog.metrics.find((metric) => metric?.key === 'progress');
  assert.ok(progressMetric);
  assert.equal(progressMetric.source_type, 'stored_period_snapshot');
  assert.deepEqual(progressMetric.supported_modes, ['cumulative', 'period']);
  assert.deepEqual(progressMetric.supported_scales, ['weekly', 'monthly']);

  const baselineCostMetric = catalog.metrics.find((metric) => metric?.key === 'baseline_cost');
  assert.ok(baselineCostMetric);
  assert.equal(baselineCostMetric.source_type, 'derived_from_baseline');
  assert.deepEqual(baselineCostMetric.supported_modes, ['spread']);
});

test('layoutTemplatesService.listTemplates requiere projectId', async () => {
  await assert.rejects(() => layoutTemplatesService.listTemplates(''), {
    message: 'projectId is required',
  });
});

test('layoutTemplatesService.createTemplate rechaza time_mode inválido para la métrica elegida', async () => {
  const payload = {
    project_id: 'project-1',
    name: 'Plantilla inválida',
    base_level: 'activity',
    time_metric: 'baseline_hours',
    time_mode: 'cumulative',
    time_scale: 'weekly',
    columns: [{ column_key: 'name', display_order: 1, is_visible: true }],
  };

  await assert.rejects(
    () => layoutTemplatesService.createTemplate(payload, plannerActor(), {}),
    { message: 'Invalid time_mode for selected time_metric' },
  );
});

test('layoutTemplatesService.createTemplate rechaza escalas inválidas', async () => {
  const payload = {
    project_id: 'project-1',
    name: 'Plantilla inválida',
    base_level: 'activity',
    time_metric: 'ev',
    time_mode: 'cumulative',
    time_scale: 'daily',
    columns: [{ column_key: 'name', display_order: 1, is_visible: true }],
  };

  await assert.rejects(
    () => layoutTemplatesService.createTemplate(payload, plannerActor(), {}),
    { message: 'Invalid time_scale' },
  );
});

test('layoutTemplatesService.createTemplate rechaza columnas duplicadas', async () => {
  const payload = {
    project_id: 'project-1',
    name: 'Plantilla inválida',
    base_level: 'activity',
    time_metric: 'ev',
    time_mode: 'cumulative',
    time_scale: 'weekly',
    columns: [
      { column_key: 'name', display_order: 1, is_visible: true },
      { column_key: 'name', display_order: 2, is_visible: true },
    ],
  };

  await assert.rejects(
    () => layoutTemplatesService.createTemplate(payload, plannerActor(), {}),
    { message: 'Duplicate column_key: name' },
  );
});

test('layoutTemplatesService.createTemplate rechaza columnas no soportadas para base_level wbs', async () => {
  const payload = {
    project_id: 'project-1',
    name: 'Plantilla inválida',
    base_level: 'wbs',
    time_metric: 'ev',
    time_mode: 'cumulative',
    time_scale: 'weekly',
    columns: [
      { column_key: 'name', display_order: 1, is_visible: true },
      { column_key: 'status', display_order: 2, is_visible: true },
    ],
  };

  await assert.rejects(
    () => layoutTemplatesService.createTemplate(payload, plannerActor(), {}),
    { message: 'Columns not supported for base_level wbs: status' },
  );
});
