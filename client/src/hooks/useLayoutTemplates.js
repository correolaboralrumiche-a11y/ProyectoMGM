import { useCallback, useEffect, useMemo, useState } from 'react';
import { layoutTemplatesApi } from '../services/layoutTemplatesApi.js';
import { getErrorMessage } from '../utils/error.js';

function sortTemplates(items = []) {
  return [...items].sort((a, b) => {
    const left = String(a?.name || '').toLowerCase();
    const right = String(b?.name || '').toLowerCase();
    return left.localeCompare(right, 'es', { sensitivity: 'base' });
  });
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

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const data = await layoutTemplatesApi.catalog();
      setCatalog(data || null);
      return data || null;
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
        const data = await layoutTemplatesApi.list(projectId);
        const items = sortTemplates(Array.isArray(data) ? data : data?.items || []);
        setTemplates(items);

        const nextSelectedId = preferredTemplateId || selectedTemplateId;
        if (items.some((item) => item.id === nextSelectedId)) {
          setSelectedTemplateId(nextSelectedId);
        } else {
          setSelectedTemplateId(items[0]?.id || '');
        }
        return items;
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo cargar la lista de plantillas.');
        setTemplatesError(message);
        throw error;
      } finally {
        setTemplatesLoading(false);
      }
    },
    [projectId, selectedTemplateId],
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
      setSelectedTemplate(detail || null);
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

    async function bootstrap() {
      try {
        if (!catalog) {
          await loadCatalog();
        }
        const items = await loadTemplates();
        if (cancelled) return;
        const initialId = items[0]?.id || '';
        if (initialId) {
          await loadSelectedTemplateResources(initialId);
        }
      } catch {
        // Errors are already handled in state.
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      setPreviewContext(null);
      setViewerData(null);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        await loadSelectedTemplateResources(selectedTemplateId);
      } catch {
        // handled above
      }
    }

    load();

    return () => {
      cancelled = true;
      if (cancelled) {
        return undefined;
      }
      return undefined;
    };
  }, [selectedTemplateId, loadSelectedTemplateResources]);

  const createTemplate = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const created = await layoutTemplatesApi.create(payload);
        const items = await loadTemplates(created?.id || '');
        const targetId = created?.id || items.find((item) => item.name === payload?.name)?.id || '';
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
        const updated = await layoutTemplatesApi.update(templateId, payload);
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
