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

function getMetricLabel(previewContext, viewerData, template) {
  return previewContext?.metric?.label || viewerData?.metric?.label || template?.time_metric || 'Métrica';
}

function getSourceType(previewContext, viewerData) {
  return previewContext?.metric_source || previewContext?.source_type || viewerData?.metric?.source_type || '—';
}

function mergeWarnings(previewContext, viewerData) {
  const previewWarnings = Array.isArray(previewContext?.warnings) ? previewContext.warnings : [];
  const viewerWarnings = Array.isArray(viewerData?.warnings) ? viewerData.warnings : [];
  const analysisWarnings = Array.isArray(viewerData?.analysis?.warnings) ? viewerData.analysis.warnings : [];
  return [...new Set([...previewWarnings, ...viewerWarnings, ...analysisWarnings].filter(Boolean))];
}

function hasAnyPositiveTemporalValue(rows = []) {
  return rows.some((row) =>
    (Array.isArray(row?.time_values) ? row.time_values : []).some((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && Math.abs(numeric) > 0.0001;
    }),
  );
}

function buildContextAlerts({ template, previewContext, viewerData, warnings, loading, readOnlyTemporal }) {
  if (!template || loading) return [];

  const alerts = [];
  const metricKey = viewerData?.metric?.key || template?.time_metric || '';
  const sourceType = getSourceType(previewContext, viewerData);
  const rows = Array.isArray(viewerData?.rows) ? viewerData.rows : [];
  const buckets = Array.isArray(viewerData?.buckets)
    ? viewerData.buckets
    : Array.isArray(previewContext?.buckets)
    ? previewContext.buckets
    : [];
  const hasTemporalValues = hasAnyPositiveTemporalValue(rows);

  if (readOnlyTemporal) {
    alerts.push({
      key: 'read-only-temporal',
      tone: 'info',
      title: 'Distribución temporal en consulta',
      message: 'El visor permanece disponible, pero solo como consulta temporal para proyectos no activos.',
    });
  }

  if (sourceType === 'stored_period_snapshot' && buckets.length === 0) {
    alerts.push({
      key: 'missing-financial-periods',
      tone: 'info',
      title: 'No hay períodos financieros utilizables',
      message:
        'La plantilla requiere buckets basados en períodos o snapshots. Define períodos financieros del proyecto y vuelve a refrescar el visor.',
    });
  }

  if ((metricKey === 'baseline_hours' || metricKey === 'baseline_cost') && warnings.some((warning) => warning.includes('línea base completa'))) {
    alerts.push({
      key: 'missing-baseline',
      tone: 'warning',
      title: 'No hay línea base suficiente para distribuir',
      message:
        'La métrica seleccionada necesita una línea base con fechas y presupuesto/HH para poder generar una distribución temporal confiable.',
    });
  }

  if (template && buckets.length > 0 && rows.length === 0) {
    alerts.push({
      key: 'missing-rows',
      tone: 'info',
      title: 'No hay datos temporales visibles',
      message:
        'La plantilla generó buckets, pero el proyecto no devolvió filas visibles. Revisa WBS, actividades y línea base del proyecto activo.',
    });
  }

  if (template && rows.length > 0 && buckets.length > 0 && !hasTemporalValues) {
    alerts.push({
      key: 'empty-temporal-values',
      tone: 'info',
      title: 'Sin valores temporales valorizados',
      message:
        'La estructura y los buckets están disponibles, pero aún no hay valores temporales valorizados para la métrica seleccionada.',
    });
  }

  return alerts;
}

export default function TemplateViewer({
  selectedTemplate,
  previewContext,
  viewerData,
  loading = false,
  error = '',
  onRefresh,
  readOnlyTemporal = false,
}) {
  const template = selectedTemplate || viewerData?.template || null;
  const warnings = mergeWarnings(previewContext, viewerData);
  const analysis = viewerData?.analysis || null;
  const bucketCount = Array.isArray(viewerData?.buckets) ? viewerData.buckets.length : 0;
  const rowCount = Array.isArray(viewerData?.rows) ? viewerData.rows.length : 0;
  const generalColumnCount = Array.isArray(viewerData?.columns) ? viewerData.columns.length : 0;
  const metricLabel = getMetricLabel(previewContext, viewerData, template);
  const sourceType = getSourceType(previewContext, viewerData);
  const projectLabel = viewerData?.project?.name
    ? `${viewerData.project.code ? `${viewerData.project.code} · ` : ''}${viewerData.project.name}`
    : '—';
  const contextAlerts = buildContextAlerts({ template, previewContext, viewerData, warnings, loading, readOnlyTemporal });

  return (
    <SectionCard
      title="Visor de plantilla"
      subtitle="Vista jerárquica tipo ERP con columnas generales, distribución temporal y validaciones analíticas del motor temporal."
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
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {!template ? (
        <InlineAlert tone="info">
          Selecciona o crea una plantilla para ver la estructura, las columnas generales y la distribución temporal.
        </InlineAlert>
      ) : null}

      {template ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryPill label="Plantilla" value={template.name} />
            <SummaryPill label="Proyecto" value={projectLabel} />
            <SummaryPill label="Nivel base" value={template.base_level} />
            <SummaryPill label="Métrica" value={metricLabel} />
            <SummaryPill label="Modo / escala" value={`${template.time_mode || '—'} · ${template.time_scale || '—'}`} />
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <SummaryPill label="Columnas generales" value={generalColumnCount} />
            <SummaryPill label="Buckets" value={bucketCount} />
            <SummaryPill label="Filas" value={rowCount} />
            <SummaryPill label="Origen temporal" value={sourceType} />
            <SummaryPill label="Filas con alertas" value={analysis?.summary?.issueRowCount ?? 0} />
          </div>

          {analysis ? (
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryPill label="Totales inconsistentes" value={analysis.summary?.totalMismatchCount ?? 0} />
              <SummaryPill label="Roll-up inconsistente" value={analysis.summary?.rollupMismatchCount ?? 0} />
              <SummaryPill label="Issues LB" value={analysis.summary?.baselineIssueCount ?? 0} />
              <SummaryPill label="Issues duración" value={analysis.summary?.durationIssueCount ?? 0} />
            </div>
          ) : null}

          {contextAlerts.map((alert) => (
            <InlineAlert key={alert.key} tone={alert.tone} title={alert.title}>
              {alert.message}
            </InlineAlert>
          ))}

          {warnings.length ? (
            <InlineAlert tone="warning" title="Advertencias del contexto temporal">
              <div className="space-y-1">
                {warnings.map((warning, index) => (
                  <div key={`${warning}:${index}`}>{warning}</div>
                ))}
              </div>
            </InlineAlert>
          ) : template && rowCount > 0 && bucketCount > 0 ? (
            <InlineAlert tone="success">
              La plantilla pasó las validaciones visibles del Sprint 21 sin advertencias críticas en buckets, totales ni roll-ups.
            </InlineAlert>
          ) : null}

          <TimeGrid
            viewerData={viewerData}
            metricKey={viewerData?.metric?.key || template.time_metric}
            metricLabel={metricLabel}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
