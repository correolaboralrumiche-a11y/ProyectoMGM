import SectionCard from '../common/SectionCard.jsx';
import InlineAlert from '../common/InlineAlert.jsx';
import TemplateColumnsSelector from './TemplateColumnsSelector.jsx';

function getMetricOptions(catalog) {
  return Array.isArray(catalog?.time_metrics) ? catalog.time_metrics : [];
}

function getModeOptions(catalog, selectedMetric) {
  const metrics = getMetricOptions(catalog);
  const selected = metrics.find((item) => item.key === selectedMetric);
  return Array.isArray(selected?.modes) ? selected.modes : [];
}

function getScaleOptions(catalog, selectedMetric) {
  const metrics = getMetricOptions(catalog);
  const selected = metrics.find((item) => item.key === selectedMetric);
  const metricScales = Array.isArray(selected?.scales) ? selected.scales : [];
  if (metricScales.length > 0) return metricScales;
  return Array.isArray(catalog?.time_scales) ? catalog.time_scales : [];
}

function getBaseLevelOptions(catalog) {
  return Array.isArray(catalog?.base_levels) ? catalog.base_levels : [];
}

function normalizeColumnPayload(selectedColumnKeys = []) {
  return selectedColumnKeys.map((columnKey, index) => ({
    column_key: columnKey,
    display_order: index + 1,
    is_visible: true,
  }));
}

export default function TemplateBuilder({
  catalog,
  form,
  setForm,
  editing = false,
  canEdit = true,
  saving = false,
  error = '',
  onSubmit,
  onReset,
}) {
  const metricOptions = getMetricOptions(catalog);
  const modeOptions = getModeOptions(catalog, form.time_metric);
  const scaleOptions = getScaleOptions(catalog, form.time_metric);
  const baseLevelOptions = getBaseLevelOptions(catalog);
  const generalColumns = Array.isArray(catalog?.general_columns) ? catalog.general_columns : [];

  function handleFieldChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleMetricChange(value) {
    const selectedMetric = metricOptions.find((item) => item.key === value) || null;
    const defaultMode = selectedMetric?.modes?.[0]?.key || '';
    const availableScales = Array.isArray(selectedMetric?.scales) ? selectedMetric.scales : [];
    const defaultScale = availableScales[0]?.key || form.time_scale || '';

    setForm((current) => ({
      ...current,
      time_metric: value,
      time_mode: defaultMode,
      time_scale: defaultScale,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      columns: normalizeColumnPayload(form.selectedColumnKeys),
    });
  }

  return (
    <SectionCard
      title={editing ? 'Editar plantilla' : 'Nueva plantilla'}
      subtitle="Configura el layout analítico reutilizable para el proyecto activo."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Limpiar
          </button>
          <button
            type="submit"
            form="layout-template-form"
            disabled={!canEdit || saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Guardando...' : editing ? 'Actualizar plantilla' : 'Crear plantilla'}
          </button>
        </div>
      }
    >
      <form id="layout-template-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Nombre</span>
            <input
              value={form.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              disabled={!canEdit || saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej. EV semanal por WBS"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Nivel estructural base</span>
            <select
              value={form.base_level}
              onChange={(event) => handleFieldChange('base_level', event.target.value)}
              disabled={!canEdit || saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {baseLevelOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Métrica temporal</span>
            <select
              value={form.time_metric}
              onChange={(event) => handleMetricChange(event.target.value)}
              disabled={!canEdit || saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {metricOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Modo temporal</span>
            <select
              value={form.time_mode}
              onChange={(event) => handleFieldChange('time_mode', event.target.value)}
              disabled={!canEdit || saving || modeOptions.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {modeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Escala temporal</span>
            <select
              value={form.time_scale}
              onChange={(event) => handleFieldChange('time_scale', event.target.value)}
              disabled={!canEdit || saving || scaleOptions.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {scaleOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(event) => handleFieldChange('is_active', event.target.checked)}
              disabled={!canEdit || saving}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block font-medium text-slate-800">Plantilla activa</span>
              <span className="block text-xs text-slate-500">
                Solo las plantillas activas deben usarse en layouts productivos.
              </span>
            </span>
          </label>
        </div>

        <TemplateColumnsSelector
          columns={generalColumns}
          selectedColumns={form.selectedColumnKeys}
          onChange={(next) => handleFieldChange('selectedColumnKeys', next)}
          disabled={!canEdit || saving}
        />
      </form>
    </SectionCard>
  );
}
