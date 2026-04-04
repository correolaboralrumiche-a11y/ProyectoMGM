import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../utils/error.js';
import { layoutTemplatesApi } from '../services/layoutTemplatesApi.js';

const DEFAULT_GENERAL_COLUMNS = [
  { key: 'code', label: 'Código', types: ['project', 'wbs', 'activity'] },
  { key: 'name', label: 'Nombre', types: ['project', 'wbs', 'activity'] },
  { key: 'start_date', label: 'Inicio', types: ['project', 'wbs', 'activity'] },
  { key: 'finish_date', label: 'Fin', types: ['project', 'wbs', 'activity'] },
  { key: 'baseline_start_date', label: 'Inicio LB', types: ['project', 'wbs', 'activity'] },
  { key: 'baseline_end_date', label: 'Fin LB', types: ['project', 'wbs', 'activity'] },
  { key: 'baseline_hours', label: 'HH LB', types: ['project', 'wbs', 'activity'] },
  { key: 'baseline_cost', label: 'Costo LB', types: ['project', 'wbs', 'activity'] },
  { key: 'progress', label: 'Avance %', types: ['project', 'wbs', 'activity'] },
  { key: 'ev_amount', label: 'EV', types: ['project', 'wbs', 'activity'] },
  { key: 'status', label: 'Estado', types: ['project', 'wbs', 'activity'] },
  { key: 'discipline', label: 'Disciplina', types: ['activity'] },
  { key: 'priority', label: 'Prioridad', types: ['activity'] },
];

const DEFAULT_BASE_LEVELS = [
  { key: 'project', value: 'project', label: 'Proyecto' },
  { key: 'wbs', value: 'wbs', label: 'WBS' },
  { key: 'activity', value: 'activity', label: 'Actividad' },
];

const DEFAULT_TIME_SCALES = [
  { key: 'weekly', value: 'weekly', label: 'Semanal' },
  { key: 'monthly', value: 'monthly', label: 'Mensual' },
];

const DEFAULT_TIME_METRICS = [
  {
    key: 'ev',
    value: 'ev',
    label: 'EV',
    source_type: 'stored_period_snapshot',
    modes: [
      { key: 'cumulative', value: 'cumulative', label: 'Acumulado' },
      { key: 'period', value: 'period', label: 'Parcial' },
    ],
  },
  {
    key: 'progress',
    value: 'progress',
    label: 'Avance %',
    source_type: 'stored_period_snapshot',
    modes: [
      { key: 'cumulative', value: 'cumulative', label: 'Acumulado' },
      { key: 'period', value: 'period', label: 'Parcial' },
    ],
  },
  {
    key: 'baseline_hours',
    value: 'baseline_hours',
    label: 'HH línea base',
    source_type: 'derived_from_baseline',
    modes: [{ key: 'spread', value: 'spread', label: 'Distribuido' }],
  },
  {
    key: 'baseline_cost',
    value: 'baseline_cost',
    label: 'Presupuesto línea base',
    source_type: 'derived_from_baseline',
    modes: [{ key: 'spread', value: 'spread', label: 'Distribuido' }],
  },
];

function titleizeMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (!normalized) return 'Modo';
  if (normalized === 'period') return 'Parcial';
  if (normalized === 'cumulative') return 'Acumulado';
  if (normalized === 'spread') return 'Distribuido';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeOption(option, fallbackValue = '') {
  if (option == null) return null;
  if (typeof option === 'string') {
    return { key: option, value: option, label: option };
  }
  const value = option.key || option.value || fallbackValue || '';
  if (!value) return null;
  return {
    ...option,
    key: value,
    value,
    label: option.label || value,
  };
}

function normalizeGeneralColumns(rawColumns) {
  const source = Array.isArray(rawColumns) && rawColumns.length ? rawColumns : DEFAULT_GENERAL_COLUMNS;
  return source
    .map((column) => ({
      key: column?.key || column?.column_key || '',
      label: column?.label || column?.name || column?.key || column?.column_key || 'Columna',
      types: Array.isArray(column?.types) && column.types.length ? column.types : ['project', 'wbs', 'activity'],
    }))
    .filter((column) => column.key);
}

function normalizeTimeMetrics(rawCatalog) {
  const source = Array.isArray(rawCatalog?.time_metrics) && rawCatalog.time_metrics.length
    ? rawCatalog.time_metrics
    : Array.isArray(rawCatalog?.metrics) && rawCatalog.metrics.length
      ? rawCatalog.metrics
      : DEFAULT_TIME_METRICS;

  return source
    .map((metric) => {
      const key = metric?.key || metric?.value || '';
      if (!key) return null;
      const rawModes = Array.isArray(metric?.modes) && metric.modes.length
        ? metric.modes
        : Array.isArray(metric?.supported_modes)
          ? metric.supported_modes
          : [];
      const modes = rawModes
        .map((mode) => normalizeOption(mode, typeof mode === 'string' ? mode : ''))
        .filter(Boolean)
        .map((mode) => ({
          ...mode,
          label: mode.label || titleizeMode(mode.key),
        }));

      const rawScales = Array.isArray(metric?.scales) && metric.scales.length
        ? metric.scales
        : Array.isArray(metric?.supported_scales)
          ? metric.supported_scales
          : [];
      const scales = rawScales
        .map((scale) => normalizeOption(scale, typeof scale === 'string' ? scale : ''))
        .filter(Boolean);

      return {
        ...metric,
        key,
        value: key,
        label: metric?.label || key,
        source_type: metric?.source_type || 'stored_period_snapshot',
        modes,
        scales,
      };
    })
    .filter(Boolean);
}

function normalizeCatalog(rawCatalog) {
  const baseLevels = (Array.isArray(rawCatalog?.base_levels) && rawCatalog.base_levels.length
    ? rawCatalog.base_levels
    : DEFAULT_BASE_LEVELS)
    .map((item) => normalizeOption(item))
    .filter(Boolean);

  const timeScales = (Array.isArray(rawCatalog?.time_scales) && rawCatalog.time_scales.length
    ? rawCatalog.time_scales
    : DEFAULT_TIME_SCALES)
    .map((item) => normalizeOption(item))
    .filter(Boolean);

  const generalColumns = normalizeGeneralColumns(rawCatalog?.general_columns);
  const timeMetrics = normalizeTimeMetrics(rawCatalog);

  return {
    ...rawCatalog,
    base_levels: baseLevels,
    time_scales: timeScales,
    general_columns: generalColumns,
    time_metrics: timeMetrics,
    metrics: timeMetrics,
  };
}

function normalizeTemplate(template) {
  if (!template) return null;
  const columns = Array.isArray(template.columns)
    ? [...template.columns].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    : [];
  return {
    ...template,
    columns,
  };
}

export function useLayoutTemplates(activeProjectId) {
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

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const response = await layoutTemplatesApi.catalog();
      const normalized = normalizeCatalog(response || {});
      setCatalog(normalized);
      return normalized;
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo cargar el catálogo de plantillas.');
      setCatalogError(message);
      throw error;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!activeProjectId) {
      setTemplates([]);
      setSelectedTemplateId('');
      setSelectedTemplate(null);
      setPreviewContext(null);
      setViewerData(null);
      setTemplatesError('');
      return [];
    }

    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const response = await layoutTemplatesApi.list(activeProjectId);
      const items = Array.isArray(response) ? response.map(normalizeTemplate) : [];
      setTemplates(items);
      setSelectedTemplateId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id || '';
      });
      return items;
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudieron cargar las plantillas del proyecto.');
      setTemplatesError(message);
      throw error;
    } finally {
      setTemplatesLoading(false);
    }
  }, [activeProjectId]);

  const loadSelectedTemplateResources = useCallback(async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setPreviewContext(null);
      setViewerData(null);
      setDetailError('');
      setViewerError('');
      return null;
    }

    setDetailLoading(true);
    setViewerLoading(true);
    setDetailError('');
    setViewerError('');
    try {
      const [detail, preview, viewer] = await Promise.all([
        layoutTemplatesApi.detail(templateId),
        layoutTemplatesApi.previewContext(templateId),
        layoutTemplatesApi.viewerData(templateId),
      ]);
      setSelectedTemplate(normalizeTemplate(detail || null));
      setPreviewContext(preview || null);
      setViewerData(viewer || null);
      return detail || null;
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo cargar el detalle de la plantilla.');
      setDetailError(message);
      setViewerError(message);
      throw error;
    } finally {
      setDetailLoading(false);
      setViewerLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadCatalog();
      } catch {
        if (cancelled) return;
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadTemplates();
      } catch {
        if (cancelled) return;
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadTemplates]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedTemplateId) {
        setSelectedTemplate(null);
        setPreviewContext(null);
        setViewerData(null);
        return;
      }
      try {
        await loadSelectedTemplateResources(selectedTemplateId);
      } catch {
        if (cancelled) return;
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId, loadSelectedTemplateResources]);

  const createTemplate = useCallback(async (payload) => {
    setSaving(true);
    try {
      const created = await layoutTemplatesApi.create(payload);
      const normalized = normalizeTemplate(created);
      await loadTemplates();
      if (normalized?.id) {
        setSelectedTemplateId(normalized.id);
      }
      return normalized;
    } finally {
      setSaving(false);
    }
  }, [loadTemplates]);

  const updateTemplate = useCallback(async (id, payload) => {
    setSaving(true);
    try {
      const updated = await layoutTemplatesApi.update(id, payload);
      const normalized = normalizeTemplate(updated);
      await loadTemplates();
      setSelectedTemplateId(id);
      return normalized;
    } finally {
      setSaving(false);
    }
  }, [loadTemplates]);

  const deleteTemplate = useCallback(async (id) => {
    setDeleting(true);
    try {
      await layoutTemplatesApi.remove(id);
      await loadTemplates();
      setSelectedTemplate(null);
      setPreviewContext(null);
      setViewerData(null);
      return true;
    } finally {
      setDeleting(false);
    }
  }, [loadTemplates]);

  const refreshSelected = useCallback(async () => {
    if (!selectedTemplateId) return null;
    return loadSelectedTemplateResources(selectedTemplateId);
  }, [loadSelectedTemplateResources, selectedTemplateId]);

  const availableTimeMetrics = useMemo(() => {
    return Array.isArray(catalog?.time_metrics) ? catalog.time_metrics : [];
  }, [catalog]);

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
    availableTimeMetrics,
    loadCatalog,
    loadTemplates,
    refreshSelected,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

export default useLayoutTemplates;
