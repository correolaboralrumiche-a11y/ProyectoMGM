import SectionCard from '../common/SectionCard.jsx';
import InlineAlert from '../common/InlineAlert.jsx';
import TimeGrid from './TimeGrid.jsx';

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      {label}: {value || '—'}
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
      title="Visor temporal"
      subtitle="Consulta la plantilla renderizada con buckets temporales y jerarquía agregada."
      actions={
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {loading ? 'Actualizando...' : 'Refrescar visor'}
        </button>
      }
    >
      <div className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        {!template ? (
          <InlineAlert tone="info">
            Selecciona o crea una plantilla para ver su layout temporal.
          </InlineAlert>
        ) : null}

        {template ? (
          <>
            <div className="flex flex-wrap gap-2">
              <SummaryPill label="Plantilla" value={template.name} />
              <SummaryPill label="Nivel" value={template.base_level} />
              <SummaryPill label="Métrica" value={metricLabel} />
              <SummaryPill label="Escala" value={template.time_scale} />
              <SummaryPill label="Buckets" value={bucketCount} />
              <SummaryPill label="Filas" value={rowCount} />
            </div>

            {warnings.length ? (
              <InlineAlert tone="warning" title="Advertencias del contexto previo">
                <ul className="list-disc pl-5">
                  {warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </InlineAlert>
            ) : null}

            <TimeGrid viewerData={viewerData} />
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
