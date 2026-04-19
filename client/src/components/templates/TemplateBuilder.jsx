import SectionCard from '../common/SectionCard.jsx';
import InlineAlert from '../common/InlineAlert.jsx';
import TemplateColumnsSelector from './TemplateColumnsSelector.jsx';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getMetricOptions(catalog) {
  return ensureArray(catalog?.time_metrics || catalog?.metrics);
}

function getModeOptions(catalog, selectedMetric) {
  const metrics = getMetricOptions(catalog);
  const selected = metrics.find((item) => item.key === selectedMetric);
  return ensureArray(selected?.modes || selected?.supported_modes);
}

function getScaleOptions(catalog, selectedMetric) {
  const metrics = getMetricOptions(catalog);
  const selected = metrics.find((item) => item.key === selectedMetric);
  const metricScales = ensureArray(selected?.scales || selected?.supported_scales);
  if (metricScales.length > 0) return metricScales;
  return ensureArray(catalog?.time_scales);
}

function getBaseLevelOptions(catalog) {
  return ensureArray(catalog?.base_levels);
}

function getCompatibleColumns(columns = [], baseLevel = '') {
  if (!baseLevel) return ensureArray(columns);

  const filtered = ensureArray(columns).filter((column) => {
    const types = ensureArray(column?.types);
    if (!types.length) return true;
    if (baseLevel === 'activity') return true;
    return types.includes(baseLevel);
  });

  return filtered.length ? filtered : ensureArray(columns);
}

function normalizeColumnPayload(selectedColumnKeys = []) {
  return selectedColumnKeys.map((columnKey, index) => ({
    column_key: columnKey,
    display_order: index + 1,
    is_visible: true,
  }));
}

function getFirstOptionKey(options = []) {
  return ensureArray(options)[0]?.key || '';
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
  const generalColumns = getCompatibleColumns(catalog?.general_columns, form.base_level);

  const catalogReady = Boolean(catalog);

  function handleFieldChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleMetricChange(value) {
    const selectedMetric = metricOptions.find((item) => item.key === value) || null;
    const nextModes = ensureArray(selectedMetric?.modes || selectedMetric?.supported_modes);
    const nextScales = ensureArray(selectedMetric?.scales || selectedMetric?.supported_scales);

    setForm((current) => {
      const currentModeStillValid = nextModes.some((item) => item.key === current.time_mode);
      const currentScaleStillValid = nextScales.some((item) => item.key === current.time_scale);

      return {
        ...current,
        time_metric: value,
        time_mode: currentModeStillValid ? current.time_mode : getFirstOptionKey(nextModes) || current.time_mode,
        time_scale: currentScaleStillValid
          ? current.time_scale
          : getFirstOptionKey(nextScales) || getFirstOptionKey(catalog?.time_scales) || current.time_scale,
      };
    });
  }

  function handleBaseLevelChange(value) {
    const compatibleColumns = getCompatibleColumns(catalog?.general_columns, value);
    const allowedKeys = new Set(compatibleColumns.map((column) => column.key));

    setForm((current) => {
      const currentSelection = ensureArray(current.selectedColumnKeys).filter((key) => allowedKeys.has(key));
      const fallbackSelection = compatibleColumns.slice(0, 4).map((column) => column.key);

      return {
        ...current,
        base_level: value,
        selectedColumnKeys: currentSelection.length ? currentSelection : fallbackSelection,
      };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      name: normalizeText(form.name),
      columns: normalizeColumnPayload(form.selectedColumnKeys),
    });
  }

  const saveDisabled =
    !catalogReady ||
    !canEdit ||
    saving ||
    !normalizeText(form.name) ||
    !form.base_level ||
    !form.time_metric ||
    !form.time_mode ||
    !form.time_scale;

  return (
    <SectionCard
      title="Configuración de plantilla"
      subtitle="Define el nivel base, métrica temporal, modo de cálculo y columnas generales del layout."
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Limpiar
          </button>
          <button
            type="submit"
            form="layout-template-builder-form"
            disabled={saveDisabled}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Guardando...' : editing ? 'Actualizar plantilla' : 'Crear plantilla'}
          </button>
        </div>
      }
    >
      {!catalogReady ? (
        <InlineAlert tone="info">Cargando catálogo técnico de plantillas...</InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      <form id="layout-template-builder-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Nombre de plantilla</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              disabled={!canEdit || saving}
              placeholder="Ej. EV semanal por WBS"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Nivel base</span>
            <select
              value={form.base_level}
              onChange={(event) => handleBaseLevelChange(event.target.value)}
              disabled={!canEdit || saving}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              {baseLevelOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Métrica temporal</span>
            <select
              value={form.time_metric}
              onChange={(event) => handleMetricChange(event.target.value)}
              disabled={!canEdit || saving}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              {metricOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Modo</span>
            <select
              value={form.time_mode}
              onChange={(event) => handleFieldChange('time_mode', event.target.value)}
              disabled={!canEdit || saving || modeOptions.length === 0}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              {modeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Escala temporal</span>
            <select
              value={form.time_scale}
              onChange={(event) => handleFieldChange('time_scale', event.target.value)}
              disabled={!canEdit || saving || scaleOptions.length === 0}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              {scaleOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active !== false}
            onChange={(event) => handleFieldChange('is_active', event.target.checked)}
            disabled={!canEdit || saving}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block font-medium text-slate-900">Plantilla activa</span>
            <span className="block text-xs text-slate-500">
              Solo las plantillas activas deben usarse en layouts productivos.
            </span>
          </span>
        </label>

        {!metricOptions.length ? (
          <InlineAlert tone="warning">
            El catálogo no devolvió métricas temporales válidas. Sprint 19 aplica compatibilidad defensiva, pero la API
            debe devolver al menos una métrica.
          </InlineAlert>
        ) : null}

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
