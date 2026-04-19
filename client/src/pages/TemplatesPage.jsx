import { useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import TemplateBuilder from '../components/templates/TemplateBuilder.jsx';
import TemplateViewer from '../components/templates/TemplateViewer.jsx';
import { useLayoutTemplates } from '../hooks/useLayoutTemplates.js';
import { getErrorMessage } from '../utils/error.js';

function getTemplatesPermissions(permissions = {}) {
  return permissions?.layoutTemplates || permissions || {};
}

function buildEmptyForm(catalog) {
  const firstMetric = Array.isArray(catalog?.time_metrics) ? catalog.time_metrics[0] : null;
  const firstMode = Array.isArray(firstMetric?.modes) ? firstMetric.modes[0] : null;
  const firstBaseLevel = Array.isArray(catalog?.base_levels) ? catalog.base_levels[0] : null;
  const firstScale = Array.isArray(catalog?.time_scales) ? catalog.time_scales[0] : null;
  const defaultColumns = (Array.isArray(catalog?.general_columns) ? catalog.general_columns : [])
    .slice(0, 4)
    .map((column) => column.key);

  return {
    name: '',
    base_level: firstBaseLevel?.key || 'wbs',
    time_metric: firstMetric?.key || 'ev',
    time_mode: firstMode?.key || 'cumulative',
    time_scale: firstScale?.key || 'weekly',
    is_active: true,
    selectedColumnKeys: defaultColumns,
  };
}

function mapTemplateToForm(template, catalog) {
  if (!template) return buildEmptyForm(catalog);
  return {
    name: template.name || '',
    base_level: template.base_level || 'wbs',
    time_metric: template.time_metric || 'ev',
    time_mode: template.time_mode || 'cumulative',
    time_scale: template.time_scale || 'weekly',
    is_active: template.is_active !== false,
    selectedColumnKeys: Array.isArray(template.columns)
      ? template.columns
          .filter((item) => item?.is_visible !== false)
          .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
          .map((item) => item.column_key)
      : buildEmptyForm(catalog).selectedColumnKeys,
  };
}

function TemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onCreateNew,
  canCreate,
  canDelete,
  onDelete,
  deleting,
}) {
  return (
    <SectionCard
      title="Plantillas del proyecto"
      subtitle="Selecciona una plantilla existente o crea una nueva definición de layout."
      actions={
        canCreate ? (
          <button
            type="button"
            onClick={onCreateNew}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Nueva plantilla
          </button>
        ) : null
      }
    >
      {!templates.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Este proyecto todavía no tiene plantillas registradas.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const active = template.id === selectedTemplateId;
            return (
              <div
                key={template.id}
                className={[
                  'rounded-2xl border p-4 transition',
                  active ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <button type="button" onClick={() => onSelect(template.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{template.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {template.base_level} · {template.time_metric} · {template.time_mode} · {template.time_scale}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                      {template.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </button>

                {active && canDelete ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onDelete(template)}
                      disabled={deleting}
                      className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {deleting ? 'Eliminando...' : 'Eliminar plantilla'}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default function TemplatesPage({ activeProjectId, activeProject, permissions = {}, operationalLock = false }) {
  const {
    catalog,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedTemplate,
    previewContext,
    viewerData,
    loading,
    errors,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refreshSelected,
  } = useLayoutTemplates(activeProjectId);

  const [form, setForm] = useState(buildEmptyForm(null));
  const [builderError, setBuilderError] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState('');

  const templatePermissions = getTemplatesPermissions(permissions);
  const canCreate = Boolean(templatePermissions?.create);
  const canUpdate = Boolean(templatePermissions?.update);
  const canDelete = Boolean(templatePermissions?.delete);
  const canWrite = editingTemplateId ? canUpdate : canCreate;

  useEffect(() => {
    if (!catalog) return;
    if (!selectedTemplate) {
      setEditingTemplateId('');
      setForm(buildEmptyForm(catalog));
      return;
    }
    setEditingTemplateId(selectedTemplate.id || '');
    setForm(mapTemplateToForm(selectedTemplate, catalog));
  }, [catalog, selectedTemplate?.id]);

  const headerMessage = useMemo(() => {
    if (!activeProject) return 'Selecciona un proyecto activo para administrar layouts reutilizables.';
    return `Proyecto activo: ${activeProject.name}`;
  }, [activeProject]);

  async function handleSubmit(payload) {
    setBuilderError('');
    try {
      const normalizedPayload = {
        project_id: activeProjectId,
        name: payload.name,
        base_level: payload.base_level,
        time_metric: payload.time_metric,
        time_mode: payload.time_mode,
        time_scale: payload.time_scale,
        is_active: payload.is_active,
        columns: payload.columns,
      };
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, normalizedPayload);
      } else {
        await createTemplate(normalizedPayload);
      }
    } catch (error) {
      setBuilderError(getErrorMessage(error, 'No se pudo guardar la plantilla.'));
    }
  }

  function handleReset() {
    setBuilderError('');
    setEditingTemplateId('');
    setSelectedTemplateId('');
    setForm(buildEmptyForm(catalog));
  }

  async function handleDelete(template) {
    if (!template?.id) return;
    const confirmed = window.confirm(`¿Eliminar la plantilla "${template.name}"?`);
    if (!confirmed) return;
    try {
      await deleteTemplate(template.id);
      handleReset();
    } catch (error) {
      setBuilderError(getErrorMessage(error, 'No se pudo eliminar la plantilla.'));
    }
  }

  if (!activeProjectId) {
    return (
      <SectionCard title="Plantillas" subtitle="Layouts analíticos reutilizables">
        <InlineAlert tone="info">Selecciona un proyecto activo para trabajar con plantillas.</InlineAlert>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Plantillas" subtitle={headerMessage}>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">Builder + visor temporal</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Métricas válidas controladas</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Semanal / mensual</span>
        </div>
      </SectionCard>

      {errors.catalog ? <InlineAlert tone="danger">{errors.catalog}</InlineAlert> : null}
      {errors.templates ? <InlineAlert tone="danger">{errors.templates}</InlineAlert> : null}
      {operationalLock ? (
        <InlineAlert tone="info">El proyecto está en modo solo lectura operativa, pero las plantillas siguen siendo configurables según permisos del módulo.</InlineAlert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <TemplateList
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onCreateNew={handleReset}
          canCreate={canCreate}
          canDelete={canDelete}
          onDelete={handleDelete}
          deleting={loading.deleting}
        />

        <div className="space-y-6">
          <TemplateBuilder
            catalog={catalog}
            form={form}
            setForm={setForm}
            editing={Boolean(editingTemplateId)}
            canEdit={canWrite}
            saving={loading.saving}
            error={builderError || errors.detail}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />

          <TemplateViewer
            selectedTemplate={selectedTemplate}
            previewContext={previewContext}
            viewerData={viewerData}
            loading={loading.viewer}
            error={errors.viewer}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    </div>
  );
}
