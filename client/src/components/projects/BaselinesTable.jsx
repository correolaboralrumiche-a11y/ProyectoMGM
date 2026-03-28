function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function BaselinesTable({
  baselines,
  loading,
  selectedBaselineId,
  onSelect,
  onDelete,
  canDelete = false,
}) {
  if (loading) {
    return <div className="text-sm text-slate-600">Cargando líneas base...</div>;
  }

  if (!baselines.length) {
    return <div className="text-sm text-slate-600">No hay líneas base registradas.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Línea base</th>
            <th className="px-4 py-3 font-medium">Creada</th>
            <th className="px-4 py-3 font-medium">WBS</th>
            <th className="px-4 py-3 font-medium">Actividades</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {baselines.map((baseline) => {
            const isSelected = baseline.id === selectedBaselineId;
            return (
              <tr key={baseline.id} className={isSelected ? 'bg-emerald-50/40' : ''}>
                <td className="px-4 py-3 text-slate-900">
                  <button
                    type="button"
                    onClick={() => onSelect(baseline.id)}
                    className="font-medium text-slate-800 hover:text-sky-700"
                  >
                    {baseline.name || 'Sin nombre'}
                  </button>
                  {baseline.description ? (
                    <div className="mt-1 text-xs text-slate-500">{baseline.description}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(baseline.created_at)}</td>
                <td className="px-4 py-3 text-slate-700">{baseline.wbs_count ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700">{baseline.activities_count ?? baseline.activity_count ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(baseline.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      Ver
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(baseline)}
                        className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700"
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
