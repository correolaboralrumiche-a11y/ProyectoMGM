import InlineAlert from '../common/InlineAlert.jsx';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

function getIndent(depth = 0) {
  return `${Math.max(Number(depth || 0), 0) * 1.1}rem`;
}

function rowTone(rowType) {
  if (rowType === 'project') return 'bg-slate-50 font-semibold text-slate-900';
  if (rowType === 'wbs') return 'bg-blue-50/40 font-medium text-slate-800';
  return 'bg-white text-slate-700';
}

function buildStructureLabel(row) {
  const code = row?.columns?.code ? `${row.columns.code} · ` : '';
  const name = row?.columns?.name || row?.id || 'Fila';
  return `${code}${name}`;
}

export default function TimeGrid({ viewerData }) {
  const columns = Array.isArray(viewerData?.columns) ? viewerData.columns : [];
  const buckets = Array.isArray(viewerData?.buckets) ? viewerData.buckets : [];
  const rows = Array.isArray(viewerData?.rows) ? viewerData.rows : [];

  if (!viewerData) {
    return <InlineAlert tone="info">Selecciona una plantilla para ver su distribución temporal.</InlineAlert>;
  }

  if (!rows.length) {
    return <InlineAlert tone="warning">La plantilla no devolvió filas visibles para el proyecto activo.</InlineAlert>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold">
              Estructura
            </th>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold whitespace-nowrap">
                {column.label}
              </th>
            ))}
            {buckets.map((bucket) => (
              <th key={bucket.key || bucket.label} className="border-b border-r border-slate-200 px-3 py-2 text-right font-semibold whitespace-nowrap">
                <div>{bucket.label || bucket.key}</div>
                {bucket.group_label ? <div className="text-[11px] font-normal text-slate-500">{bucket.group_label}</div> : null}
              </th>
            ))}
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold whitespace-nowrap">Total temporal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={rowTone(row.row_type)}>
              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-2 align-top">
                <div style={{ paddingLeft: getIndent(row.depth) }} className="flex min-w-[240px] items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-slate-300" />
                  <div>
                    <div className="font-medium text-slate-900">{buildStructureLabel(row)}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">{row.row_type}</div>
                  </div>
                </div>
              </td>

              {columns.map((column) => (
                <td key={`${row.id}:${column.key}`} className="border-b border-r border-slate-200 px-3 py-2 align-top whitespace-nowrap">
                  {formatValue(row?.columns?.[column.key])}
                </td>
              ))}

              {(Array.isArray(row.time_values) ? row.time_values : []).map((value, index) => (
                <td key={`${row.id}:bucket:${index}`} className="border-b border-r border-slate-200 px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                  {formatValue(value)}
                </td>
              ))}

              <td className="border-b border-slate-200 px-3 py-2 text-right align-top font-semibold whitespace-nowrap tabular-nums">
                {formatValue(row.time_total_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
