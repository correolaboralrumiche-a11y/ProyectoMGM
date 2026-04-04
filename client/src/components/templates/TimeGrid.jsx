function formatNumber(value, metricKey) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const numeric = Number(value);
  const options =
    metricKey === 'progress'
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
  return new Intl.NumberFormat('es-PE', options).format(numeric);
}

function renderGroupedHeader(groups = []) {
  if (!groups.length) return null;
  return (
    <tr className="bg-slate-100">
      <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        Estructura
      </th>
      {groups.map((group) => (
        <th
          key={group.key}
          colSpan={group.span || 1}
          className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {group.label}
        </th>
      ))}
      <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Total
      </th>
    </tr>
  );
}

function renderBucketsHeader(buckets = []) {
  return (
    <tr className="bg-slate-50">
      <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        Valores por período
      </th>
      {buckets.map((bucket) => (
        <th key={bucket.key} className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
          <div>{bucket.label}</div>
          {bucket.sub_label ? <div className="text-[11px] text-slate-400">{bucket.sub_label}</div> : null}
        </th>
      ))}
      <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Total temporal
      </th>
    </tr>
  );
}

function RowLabel({ row }) {
  const paddingLeft = `${Math.max(0, row.depth || 0) * 18 + 12}px`;
  const typeStyles =
    row.row_type === 'project'
      ? 'font-semibold text-slate-900'
      : row.row_type === 'wbs'
        ? 'font-medium text-slate-800'
        : 'text-slate-700';

  return (
    <div className={['flex min-w-[240px] items-center gap-2', typeStyles].join(' ')} style={{ paddingLeft }}>
      <span className="truncate">{row.label || row.name || row.code || 'Fila'}</span>
    </div>
  );
}

export default function TimeGrid({ viewerData, metricKey }) {
  const groups = Array.isArray(viewerData?.bucket_groups) ? viewerData.bucket_groups : [];
  const buckets = Array.isArray(viewerData?.buckets) ? viewerData.buckets : [];
  const rows = Array.isArray(viewerData?.rows) ? viewerData.rows : [];

  if (!rows.length) {
    return <p className="text-sm text-slate-500">No hay filas disponibles para la plantilla seleccionada.</p>;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          {renderGroupedHeader(groups)}
          {renderBucketsHeader(buckets)}
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = Array.isArray(row.time_values) ? row.time_values : [];
            return (
              <tr key={row.key || row.id} className="even:bg-slate-50/50 hover:bg-blue-50/40">
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 align-top even:bg-slate-50/50">
                  <RowLabel row={row} />
                </td>
                {values.map((item, index) => (
                  <td key={`${row.key || row.id}:${buckets[index]?.key || index}`} className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                    {formatNumber(item, metricKey)}
                  </td>
                ))}
                <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-slate-900">
                  {formatNumber(row.time_total_value, metricKey)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
