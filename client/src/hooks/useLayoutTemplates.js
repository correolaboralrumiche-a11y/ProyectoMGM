import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutTemplatesApi } from '../services/layoutTemplatesApi.js';
import { getErrorMessage } from '../utils/error.js';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function uniqueStrings(values = []) {
  return [...new Set(ensureArray(values).filter(Boolean).map((value) => String(value)))];
}

function titleCase(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildFriendlyLabel(key, fallback = '') {
  const normalized = normalizeText(key);
  if (!normalized) return fallback || '—';

  if (normalized === 'ev') return 'EV';
  if (normalized === 'wbs') return 'WBS';
  if (normalized === 'weekly') return 'Semanal';
  if (normalized === 'monthly') return 'Mensual';
  if (normalized === 'spread') return 'Spread';
  if (normalized === 'cumulative') return 'Acumulado';
  if (normalized === 'period') return 'Período';
  if (normalized === 'baseline_hours') return 'HH LB';
  if (normalized === 'baseline_cost') return 'Costo LB';
  if (normalized === 'progress') return 'Avance %';

  return fallback || titleCase(normalized);
}

function normalizeOption(item, fallbackKey = '') {
  if (typeof item === 'string') {
    const key = normalizeText(item);
    if (!key) return null;
    return {
      key,
      value: key,
      label: buildFriendlyLabel(key),
    };
  }

  if (!item || typeof item !== 'object') return null;

  const key = normalizeText(item.key || item.value || item.id || fallbackKey);
  if (!key) return null;

  const label = normalizeText(item.label) || buildFriendlyLabel(key);

  return {
    ...item,
    key,
    value: key,
    label,
  };
}

function normalizeModeOptions(items) {
  return ensureArray(items)
    .map((item) => normalizeOption(item))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      label: normalizeText(item.label) || buildFriendlyLabel(item.key),
    }));
}

function normalizeScaleOptions(items) {
  return ensureArray(items)
    .map((item) => normalizeOption(item))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      label: normalizeText(item.label) || buildFriendlyLabel(item.key),
    }));
}

function normalizeMetric(metric) {
  const normalized = normalizeOption(metric);
  if (!normalized) return null;

  const modes = normalizeModeOptions(metric?.modes || metric?.supported_modes);
  const scales = normalizeScaleOptions(metric?.scales || metric?.supported_scales);

  return {
    ...metric,
    ...normalized,
    modes,
    scales,
    supported_modes: modes.map((item) => item.key),
    supported_scales: scales.map((item) => item.key),
  };
}

function normalizeGeneralColumn(column) {
  const normalized = normalizeOption(column);
  if (!normalized) return null;

  return {
    ...column,
    ...normalized,
    types: ensureArray(column?.types),
  };
}

function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') return null;

  const baseLevels = ensureArray(catalog.base_levels)
    .map((item) => normalizeOption(item))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      label: normalizeText(item.label) || buildFriendlyLabel(item.key),
    }));

  const timeScales = normalizeScaleOptions(catalog.time_scales);
  const generalColumns = ensureArray(catalog.general_columns)
    .map((item) => normalizeGeneralColumn(item))
    .filter(Boolean);

  const timeMetrics = ensureArray(catalog.time_metrics || catalog.metrics)
    .map((item) => normalizeMetric(item))
    .filter(Boolean);

  return {
    ...catalog,
    base_levels: baseLevels,
    time_scales: timeScales,
    general_columns: generalColumns,
    time_metrics: timeMetrics,
    metrics: timeMetrics,
  };
}

function normalizeTemplateColumn(column, index = 0) {
  const columnKey = normalizeText(column?.column_key || column?.key);
  if (!columnKey) return null;

  const displayOrder = Number(column?.display_order);

  return {
    ...column,
    column_key: columnKey,
    key: columnKey,
    display_order: Number.isFinite(displayOrder) ? displayOrder : index + 1,
    is_visible: column?.is_visible !== false,
  };
}

function normalizeTemplate(template) {
  if (!template || typeof template !== 'object') return null;

  return {
    ...template,
    name: normalizeText(template.name),
    base_level: normalizeText(template.base_level) || 'wbs',
    time_metric: normalizeText(template.time_metric) || 'ev',
    time_mode: normalizeText(template.time_mode) || 'cumulative',
    time_scale: normalizeText(template.time_scale) || 'weekly',
    is_active: template.is_active !== false,
    columns: ensureArray(template.columns)
      .map((column, index) => normalizeTemplateColumn(column, index))
      .filter(Boolean)
      .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0)),
  };
}

function normalizePreviewContext(previewContext) {
  if (!previewContext || typeof previewContext !== 'object') return null;

  return {
    ...previewContext,
    buckets: ensureArray(previewContext.buckets),
    bucket_groups: ensureArray(previewContext.bucket_groups),
    warnings: ensureArray(previewContext.warnings),
    inferred_range:
      previewContext.inferred_range && typeof previewContext.inferred_range === 'object'
        ? previewContext.inferred_range
        : { start_date: null, end_date: null },
  };
}

function normalizeViewerRow(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    ...row,
    depth: Number.isFinite(Number(row.depth)) ? Number(row.depth) : 0,
    has_children: Boolean(row.has_children),
    columns: row.columns && typeof row.columns === 'object' ? row.columns : {},
    time_values: ensureArray(row.time_values),
    time_total_value: row.time_total_value ?? null,
  };
}

function normalizeViewerData(viewerData) {
  if (!viewerData || typeof viewerData !== 'object') return null;

  return {
    ...viewerData,
    columns: ensureArray(viewerData.columns)
      .map((column) => normalizeOption(column))
      .filter(Boolean)
      .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0)),
    bucket_groups: ensureArray(viewerData.bucket_groups),
    buckets: ensureArray(viewerData.buckets),
    rows: ensureArray(viewerData.rows).map((row) => normalizeViewerRow(row)).filter(Boolean),
    warnings: ensureArray(viewerData.warnings),
  };
}

function sortTemplates(items = []) {
  return [...items].sort((left, right) => {
    const a = String(left?.name || '').toLowerCase();
    const b = String(right?.name || '').toLowerCase();
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
}

function resetProjectScopedState({
  setTemplates,
  setSelectedTemplateId,
  setSelectedTemplate,
  setPreviewContext,
  setViewerData,
  setTemplatesError,
  setDetailError,
  setViewerError,
}) {
  setTemplates([]);
  setSelectedTemplateId('');
  setSelectedTemplate(null);
  setPreviewContext(null);
  setViewerData(null);
  setTemplatesError('');
  setDetailError('');
  setViewerError('');
}

function getMetricKey(viewerData, template) {
  return normalizeText(viewerData?.metric?.key || template?.time_metric || '');
}

function getMetricMode(viewerData, template) {
  return normalizeText(viewerData?.metric?.mode || template?.time_mode || '');
}

function isAdditiveMetric(metricKey) {
  return ['ev', 'baseline_hours', 'baseline_cost'].includes(metricKey);
}

function getLastNumeric(values = []) {
  const reversed = [...ensureArray(values)].reverse();
  const found = reversed.find((value) => value !== null && value !== undefined && value !== '');
  return found === undefined ? 0 : toNumber(found, 0);
}

function expectedTotalFromValues(values, metricKey, metricMode) {
  const normalized = ensureArray(values).map((value) => toNumber(value, 0));
  if (isAdditiveMetric(metricKey)) {
    return round2(normalized.reduce((acc, value) => acc + value, 0));
  }
  if (metricMode === 'cumulative') {
    return round2(getLastNumeric(normalized));
  }
  return round2(normalized.reduce((acc, value) => acc + value, 0));
}

function approximatelyEqual(left, right, tolerance = 0.15) {
  return Math.abs(toNumber(left, 0) - toNumber(right, 0)) <= tolerance;
}

function hasDateValue(value) {
  return Boolean(normalizeText(value));
}

function getActivityWeight(columns = {}) {
  const baselineCost = toNumber(columns.baseline_cost, 0);
  const budgetCost = toNumber(columns.budget_cost, 0);
  const baselineHours = toNumber(columns.baseline_hours, 0);
  const budgetHours = toNumber(columns.budget_hours, 0);

  if (baselineCost > 0) return baselineCost;
  if (budgetCost > 0) return budgetCost;
  if (baselineHours > 0) return baselineHours;
  if (budgetHours > 0) return budgetHours;
  return 0;
}

function inferRowBaselineCompleteness(row) {
  const columns = row?.columns || {};
  const hasBaselineDates = hasDateValue(columns.baseline_start_date) && hasDateValue(columns.baseline_end_date);
  const hasBaselineBudget = toNumber(columns.baseline_hours, 0) > 0 || toNumber(columns.baseline_cost, 0) > 0;
  return {
    hasBaselineDates,
    hasBaselineBudget,
    hasAnyBaselineSignal:
      hasBaselineDates ||
      hasBaselineBudget ||
      hasDateValue(columns.baseline_start_date) ||
      hasDateValue(columns.baseline_end_date),
  };
}

function dayDifferenceInclusive(startDate, endDate) {
  const start = normalizeText(startDate);
  const end = normalizeText(endDate);
  if (!start || !end) return null;

  const left = new Date(`${start}T00:00:00Z`);
  const right = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;

  return Math.floor((right.getTime() - left.getTime()) / 86400000) + 1;
}

function buildHierarchyMaps(rows = []) {
  const rowsById = new Map();
  const childrenByParent = new Map();

  ensureArray(rows).forEach((row) => {
    rowsById.set(row.id, row);
    if (row.parent_id) {
      if (!childrenByParent.has(row.parent_id)) childrenByParent.set(row.parent_id, []);
      childrenByParent.get(row.parent_id).push(row.id);
    }
  });

  return { rowsById, childrenByParent };
}

function buildRollupExpectedValues(rowId, rowsById, childrenByParent, metricKey) {
  const childIds = ensureArray(childrenByParent.get(rowId));
  if (!childIds.length) return null;

  const activityRows = [];
  const stack = [...childIds];

  while (stack.length > 0) {
    const candidateId = stack.pop();
    const candidate = rowsById.get(candidateId);
    if (!candidate) continue;

    if (candidate.row_type === 'activity') {
      activityRows.push(candidate);
      continue;
    }

    ensureArray(childrenByParent.get(candidate.id)).forEach((nextId) => stack.push(nextId));
  }

  if (!activityRows.length) return null;

  const bucketLength = Math.max(...activityRows.map((row) => ensureArray(row.time_values).length), 0);
  if (bucketLength <= 0) return null;

  if (isAdditiveMetric(metricKey)) {
    return Array.from({ length: bucketLength }, (_, index) =>
      round2(activityRows.reduce((acc, row) => acc + toNumber(row.time_values?.[index], 0), 0)),
    );
  }

  return Array.from({ length: bucketLength }, (_, index) => {
    let weightedAccumulator = 0;
    let totalWeight = 0;
    let simpleAccumulator = 0;
    let count = 0;

    activityRows.forEach((row) => {
      const value = toNumber(row.time_values?.[index], 0);
      const weight = getActivityWeight(row.columns);

      if (weight > 0) {
        weightedAccumulator += value * weight;
        totalWeight += weight;
      }

      simpleAccumulator += value;
      count += 1;
    });

    if (count === 0) return 0;
    return round2(totalWeight > 0 ? weightedAccumulator / totalWeight : simpleAccumulator / count);
  });
}

function buildTemplateAnalytics({ template, previewContext, viewerData }) {
  if (!viewerData) {
    return {
      warnings: uniqueStrings(previewContext?.warnings || []),
      rowIssuesById: {},
      summary: {
        bucketCount: ensureArray(previewContext?.buckets).length,
        rowCount: 0,
        issueRowCount: 0,
        totalMismatchCount: 0,
        rollupMismatchCount: 0,
        baselineIssueCount: 0,
        durationIssueCount: 0,
      },
    };
  }

  const metricKey = getMetricKey(viewerData, template);
  const metricMode = getMetricMode(viewerData, template);
  const rows = ensureArray(viewerData.rows);
  const buckets = ensureArray(viewerData.buckets);
  const rowIssuesById = {};

  let totalMismatchCount = 0;
  let rollupMismatchCount = 0;
  let baselineIssueCount = 0;
  let durationIssueCount = 0;

  rows.forEach((row) => {
    const issues = [];
    const expectedTotal = expectedTotalFromValues(row.time_values, metricKey, metricMode);

    if (!approximatelyEqual(row.time_total_value, expectedTotal)) {
      totalMismatchCount += 1;
      issues.push({
        key: 'time_total_mismatch',
        severity: 'warning',
        message: `Total temporal inconsistente. Esperado: ${expectedTotal}. Actual: ${round2(row.time_total_value)}.`,
      });
    }

    if (row.row_type === 'activity') {
      const baseline = inferRowBaselineCompleteness(row);
      const baselineDuration = dayDifferenceInclusive(row.columns?.baseline_start_date, row.columns?.baseline_end_date);
      const activityDuration = dayDifferenceInclusive(row.columns?.start_date, row.columns?.finish_date);

      if ((metricKey === 'baseline_hours' || metricKey === 'baseline_cost') && !baseline.hasBaselineDates) {
        baselineIssueCount += 1;
        issues.push({
          key: 'missing_baseline_dates',
          severity: 'warning',
          message: 'La actividad no tiene línea base completa (fechas de línea base ausentes).',
        });
      }

      if ((metricKey === 'baseline_hours' || metricKey === 'baseline_cost') && !baseline.hasBaselineBudget) {
        baselineIssueCount += 1;
        issues.push({
          key: 'missing_baseline_budget',
          severity: 'warning',
          message: 'La actividad no tiene HH o costo de línea base para distribuir en el tiempo.',
        });
      }

      if (baselineDuration !== null && baselineDuration <= 0) {
        durationIssueCount += 1;
        issues.push({
          key: 'invalid_baseline_duration',
          severity: 'warning',
          message: 'La duración de línea base es cero o negativa.',
        });
      }

      if (activityDuration !== null && activityDuration <= 0) {
        durationIssueCount += 1;
        issues.push({
          key: 'invalid_activity_duration',
          severity: 'warning',
          message: 'La duración de la actividad es cero o negativa.',
        });
      }

      if (metricKey === 'progress') {
        const outOfRange = ensureArray(row.time_values).some((value) => toNumber(value, 0) < 0 || toNumber(value, 0) > 100);
        if (outOfRange) {
          issues.push({
            key: 'progress_out_of_range',
            severity: 'warning',
            message: 'Se detectaron valores de avance fuera del rango 0–100%.',
          });
        }
      }

      if ((metricKey === 'ev' || metricKey === 'progress') && metricMode === 'cumulative') {
        const values = ensureArray(row.time_values).map((value) => toNumber(value, 0));
        const decreasingIndex = values.findIndex((value, index) => index > 0 && value < values[index - 1] - 0.15);
        if (decreasingIndex >= 0) {
          issues.push({
            key: 'cumulative_decrease',
            severity: 'warning',
            message: 'Se detectó una caída en una serie acumulada; revisa snapshots y cierres de período.',
          });
        }
      }

      if ((metricKey === 'ev' || metricKey === 'progress') && metricMode === 'period') {
        const negatives = ensureArray(row.time_values).some((value) => toNumber(value, 0) < -0.15);
        if (negatives) {
          issues.push({
            key: 'negative_period_value',
            severity: 'warning',
            message: 'Se detectaron valores negativos por período; revisa snapshots parciales o cierres reprocesados.',
          });
        }
      }
    }

    if (issues.length) {
      rowIssuesById[row.id] = issues;
    }
  });

  const activityRowsVisible = rows.filter((row) => row.row_type === 'activity');
  if (activityRowsVisible.length > 0) {
    const { rowsById, childrenByParent } = buildHierarchyMaps(rows);

    rows.forEach((row) => {
      if (row.row_type === 'activity') return;
      const expectedValues = buildRollupExpectedValues(row.id, rowsById, childrenByParent, metricKey);
      if (!expectedValues) return;

      const mismatchedBuckets = expectedValues.filter((value, index) => !approximatelyEqual(value, row.time_values?.[index])).length;
      const expectedTotal = expectedTotalFromValues(expectedValues, metricKey, metricMode);
      const totalMismatch = !approximatelyEqual(expectedTotal, row.time_total_value);

      if (mismatchedBuckets > 0 || totalMismatch) {
        rollupMismatchCount += 1;
        const issues = rowIssuesById[row.id] ? [...rowIssuesById[row.id]] : [];
        issues.push({
          key: 'rollup_mismatch',
          severity: 'warning',
          message:
            mismatchedBuckets > 0
              ? `El roll-up jerárquico no cuadra en ${mismatchedBuckets} bucket(s).`
              : 'El total del roll-up jerárquico no cuadra con las hojas visibles.',
        });
        rowIssuesById[row.id] = issues;
      }
    });
  }

  const warnings = [];
  const previewWarnings = ensureArray(previewContext?.warnings);
  warnings.push(...previewWarnings);

  if (!buckets.length) {
    warnings.push('La plantilla no generó buckets temporales para el proyecto activo.');
  }

  if (!rows.length) {
    warnings.push('La plantilla no devolvió filas para validar el motor temporal.');
  }

  if (viewerData?.metric?.source_type === 'stored_period_snapshot') {
    const bucketLinks = buckets.filter((bucket) => bucket?.financial_period_id || bucket?.snapshot_id).length;
    if (buckets.length > 0 && bucketLinks === 0) {
      warnings.push('La métrica depende de snapshots por período, pero los buckets no están enlazados a períodos financieros o snapshots.');
    } else if (bucketLinks > 0 && bucketLinks < buckets.length) {
      warnings.push('Algunos buckets temporales no están enlazados a períodos financieros o snapshots cerrados.');
    }
  }

  if ((metricKey === 'baseline_hours' || metricKey === 'baseline_cost') && activityRowsVisible.length > 0) {
    const completeBaselineRows = activityRowsVisible.filter((row) => {
      const baseline = inferRowBaselineCompleteness(row);
      return baseline.hasBaselineDates && baseline.hasBaselineBudget;
    }).length;

    if (completeBaselineRows === 0) {
      warnings.push('No se encontraron actividades con línea base completa para distribuir HH/costo en el tiempo.');
    }
  }

  if (totalMismatchCount > 0) {
    warnings.push(`Se detectaron ${totalMismatchCount} fila(s) con time_total_value inconsistente frente a sus buckets.`);
  }

  if (rollupMismatchCount > 0) {
    warnings.push(`Se detectaron ${rollupMismatchCount} fila(s) con roll-up jerárquico inconsistente.`);
  }

  const rowIssueCount = Object.keys(rowIssuesById).length;

  return {
    warnings: uniqueStrings(warnings),
    rowIssuesById,
    summary: {
      bucketCount: buckets.length,
      rowCount: rows.length,
      issueRowCount: rowIssueCount,
      totalMismatchCount,
      rollupMismatchCount,
      baselineIssueCount,
      durationIssueCount,
    },
  };
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStoredValue(key, fallback = '') {
  if (!canUseStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function setStoredValue(key, value) {
  if (!canUseStorage()) return;
  try {
    if (value === null || value === undefined || value === '') {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors in private mode / strict browsers.
  }
}

function getSelectionStorageKey(projectId) {
  return `proyectomgm.templates.selected.${projectId}`;
}

function readStoredTemplateSelection(projectId) {
  if (!projectId) return '';
  return normalizeText(getStoredValue(getSelectionStorageKey(projectId), ''));
}

function persistTemplateSelection(projectId, templateId) {
  if (!projectId) return;
  setStoredValue(getSelectionStorageKey(projectId), templateId || '');
}

export function useLayoutTemplates(projectId) {
  const [catalog, setCatalog] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewContext, setPreviewContext] = useState(null);
  const [viewerData, setViewerData] = useState(null);

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [catalogError, setCatalogError] = useState('');
  const [templatesError, setTemplatesError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [viewerError, setViewerError] = useState('');

  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const catalogRef = useRef(null);
  const selectedTemplateIdRef = useRef('');

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    selectedTemplateIdRef.current = selectedTemplateId;
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!projectId) return;
    if (selectedTemplateId && !templates.some((item) => item.id === selectedTemplateId)) return;
    persistTemplateSelection(projectId, selectedTemplateId);
  }, [projectId, selectedTemplateId, templates]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');

    try {
      const response = await layoutTemplatesApi.catalog();
      const normalized = normalizeCatalog(response);
      setCatalog(normalized);
      return normalized;
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo cargar el catálogo técnico de plantillas.');
      setCatalogError(message);
      throw error;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(
    async (preferredTemplateId = '') => {
      if (!projectId) {
        resetProjectScopedState({
          setTemplates,
          setSelectedTemplateId,
          setSelectedTemplate,
          setPreviewContext,
          setViewerData,
          setTemplatesError,
          setDetailError,
          setViewerError,
        });
        return [];
      }

      const requestId = ++listRequestRef.current;
      setTemplatesLoading(true);
      setTemplatesError('');

      try {
        const response = await layoutTemplatesApi.list(projectId);
        const items = sortTemplates(
          ensureArray(Array.isArray(response) ? response : response?.items)
            .map((item) => normalizeTemplate(item))
            .filter(Boolean),
        );

        if (requestId !== listRequestRef.current) return items;

        setTemplates(items);

        const storedSelection = readStoredTemplateSelection(projectId);
        const targetId = preferredTemplateId || storedSelection || selectedTemplateIdRef.current;
        if (items.some((item) => item.id === targetId)) {
          setSelectedTemplateId(targetId);
        } else {
          const firstId = items[0]?.id || '';
          setSelectedTemplateId(firstId);
        }

        return items;
      } catch (error) {
        if (requestId === listRequestRef.current) {
          const message = getErrorMessage(error, 'No se pudo cargar la lista de plantillas.');
          setTemplatesError(message);
        }
        throw error;
      } finally {
        if (requestId === listRequestRef.current) {
          setTemplatesLoading(false);
        }
      }
    },
    [projectId],
  );

  const loadSelectedTemplateResources = useCallback(async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setPreviewContext(null);
      setViewerData(null);
      setDetailError('');
      setViewerError('');
      return null;
    }

    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setViewerLoading(true);
    setDetailError('');
    setViewerError('');

    try {
      const [detailResponse, previewResponse, viewerResponse] = await Promise.all([
        layoutTemplatesApi.detail(templateId),
        layoutTemplatesApi.previewContext(templateId),
        layoutTemplatesApi.viewerData(templateId),
      ]);

      if (requestId !== detailRequestRef.current) return null;

      const detail = normalizeTemplate(detailResponse);
      const preview = normalizePreviewContext(previewResponse);
      const viewer = normalizeViewerData(viewerResponse);
      const analysis = buildTemplateAnalytics({ template: detail, previewContext: preview, viewerData: viewer });

      const enrichedPreview = preview
        ? {
            ...preview,
            warnings: uniqueStrings([...(preview?.warnings || []), ...(analysis.warnings || [])]),
          }
        : null;

      const enrichedViewer = viewer
        ? {
            ...viewer,
            warnings: uniqueStrings([...(viewer?.warnings || []), ...(analysis.warnings || [])]),
            analysis,
          }
        : null;

      setSelectedTemplate(detail);
      setPreviewContext(enrichedPreview);
      setViewerData(enrichedViewer);

      return detail;
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        const message = getErrorMessage(error, 'No se pudo cargar el detalle de la plantilla.');
        setDetailError(message);
        setViewerError(message);
      }
      throw error;
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
        setViewerLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!projectId) {
        resetProjectScopedState({
          setTemplates,
          setSelectedTemplateId,
          setSelectedTemplate,
          setPreviewContext,
          setViewerData,
          setTemplatesError,
          setDetailError,
          setViewerError,
        });
        return;
      }

      try {
        if (!catalogRef.current) {
          await loadCatalog();
        }

        const preferredId = readStoredTemplateSelection(projectId);
        const items = await loadTemplates(preferredId);
        if (cancelled) return;

        const initialId = items.find((item) => item.id === preferredId)?.id || items[0]?.id || '';

        if (initialId) {
          setSelectedTemplateId(initialId);
          await loadSelectedTemplateResources(initialId);
        } else {
          setSelectedTemplate(null);
          setPreviewContext(null);
          setViewerData(null);
        }
      } catch {
        // Errors are already persisted in state.
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [projectId, loadCatalog, loadTemplates, loadSelectedTemplateResources]);

  useEffect(() => {
    if (!projectId || !selectedTemplateId) {
      if (!selectedTemplateId) {
        setSelectedTemplate(null);
        setPreviewContext(null);
        setViewerData(null);
      }
      return;
    }

    async function load() {
      try {
        await loadSelectedTemplateResources(selectedTemplateId);
      } catch {
        // Errors are already persisted in state.
      }
    }

    load();
  }, [projectId, selectedTemplateId, loadSelectedTemplateResources]);

  const createTemplate = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const createdResponse = await layoutTemplatesApi.create(payload);
        const created = normalizeTemplate(createdResponse);
        const items = await loadTemplates(created?.id || '');
        const targetId = created?.id || items.find((item) => item.name === normalizeText(payload?.name))?.id || '';

        if (targetId) {
          setSelectedTemplateId(targetId);
          await loadSelectedTemplateResources(targetId);
        }

        return created;
      } finally {
        setSaving(false);
      }
    },
    [loadTemplates, loadSelectedTemplateResources],
  );

  const updateTemplate = useCallback(
    async (templateId, payload) => {
      setSaving(true);
      try {
        const updatedResponse = await layoutTemplatesApi.update(templateId, payload);
        const updated = normalizeTemplate(updatedResponse);
        await loadTemplates(templateId);
        setSelectedTemplateId(templateId);
        await loadSelectedTemplateResources(templateId);
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [loadTemplates, loadSelectedTemplateResources],
  );

  const deleteTemplate = useCallback(
    async (templateId) => {
      setDeleting(true);
      try {
        await layoutTemplatesApi.remove(templateId);
        const items = await loadTemplates();
        const nextId = items[0]?.id || '';
        setSelectedTemplateId(nextId);

        if (nextId) {
          await loadSelectedTemplateResources(nextId);
        } else {
          setSelectedTemplate(null);
          setPreviewContext(null);
          setViewerData(null);
        }
      } finally {
        setDeleting(false);
      }
    },
    [loadTemplates, loadSelectedTemplateResources],
  );

  const refreshSelected = useCallback(async () => {
    if (!selectedTemplateId) return null;
    return loadSelectedTemplateResources(selectedTemplateId);
  }, [loadSelectedTemplateResources, selectedTemplateId]);

  const availableTimeMetrics = useMemo(() => ensureArray(catalog?.time_metrics), [catalog]);

  const status = useMemo(
    () => ({
      hasProject: Boolean(projectId),
      hasTemplates: templates.length > 0,
      hasSelection: Boolean(selectedTemplateId),
      hasBuckets: ensureArray(previewContext?.buckets).length > 0 || ensureArray(viewerData?.buckets).length > 0,
      hasRows: ensureArray(viewerData?.rows).length > 0,
      storedSelection: readStoredTemplateSelection(projectId),
    }),
    [projectId, previewContext?.buckets, selectedTemplateId, templates.length, viewerData?.buckets, viewerData?.rows],
  );

  return {
    catalog,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedTemplate,
    previewContext,
    viewerData,
    loading: {
      catalog: catalogLoading,
      templates: templatesLoading,
      detail: detailLoading,
      viewer: viewerLoading,
      saving,
      deleting,
    },
    errors: {
      catalog: catalogError,
      templates: templatesError,
      detail: detailError,
      viewer: viewerError,
    },
    status,
    availableTimeMetrics,
    loadCatalog,
    loadTemplates,
    refreshSelected,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
