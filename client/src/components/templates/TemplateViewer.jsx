import SectionCard from '../common/SectionCard.jsx';
import InlineAlert from '../common/InlineAlert.jsx';
import TimeGrid from './TimeGrid.jsx';

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value || '—'}</div>
    </div>
  );
}

export default function TemplateViewer({
  selectedTemplate,
  previewContext,
  viewerData,
  loading = false,
  error = '',
  onRefresh,
}) {
  const template = selectedTemplate || viewerData?.template || null;
  const metricLabel = previewContext?.metric?.label || template?.time_metric || 'Métrica';
  const warnings = Array.isArray(previewContext?.warnings) ? previewContext.warnings : [];
  const bucketCount = Array.isArray(viewerData?.buckets) ? viewerData.buckets.length : 0;
  const rowCount = Array.isArray(viewerData?.rows) ? viewerData.rows.length : 0;

  return (
    <SectionCard
      title="Visor de plantilla"
      subtitle="Renderiza la estructura jerárquica con la métrica distribuida en el tiempo."
      actions={
        <button
          type="button"
          onClick={onRefresh}
          disabled={!template || loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {loading ? 'Actualizando...' : 'Refrescar visor'}
        </button>
      }
    >
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {!template ? (
        <InlineAlert variant="info">
          Selecciona o crea una plantilla para ver su layout temporal.
        </InlineAlert>
      ) : null}

      {template ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryPill label="Plantilla" value={template.name} />
            <SummaryPill label="Nivel base" value={template.base_level} />
            <SummaryPill label="Métrica" value={metricLabel} />
            <SummaryPill label="Modo" value={template.time_mode} />
            <SummaryPill label="Escala" value={template.time_scale} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryPill label="Buckets" value={bucketCount} />
            <SummaryPill label="Filas" value={rowCount} />
            <SummaryPill label="Origen temporal" value={previewContext?.source_type || '—'} />
          </div>

          {warnings.length ? (
            <InlineAlert variant="warning">
              <div className="space-y-1">
                {warnings.map((warning, index) => (
                  <div key={`${warning}:${index}`}>{warning}</div>
                ))}
              </div>
            </InlineAlert>
          ) : null}

          <TimeGrid viewerData={viewerData} metricKey={template.time_metric} />
        </div>
      ) : null}
    </SectionCard>
  );
}
