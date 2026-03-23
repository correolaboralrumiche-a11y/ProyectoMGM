function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function BaselinesTable({
  baselines,
  loading,
  selectedBaselineId,
  onSelect,
  onDelete,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">Línea base</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">Creada</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">WBS</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">Actividades</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-600">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-slate-500">
                Cargando líneas base...
              </td>
            </tr>
          ) : baselines.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-slate-500">
                No hay líneas base registradas.
              </td>
            </tr>
          ) : (
            baselines.map((baseline) => {
              const isSelected = baseline.id === selectedBaselineId;
              return (
                <tr
                  key={baseline.id}
                  className={isSelected ? 'bg-sky-50' : ''}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(baseline.id)}
                      className="font-medium text-slate-800 hover:text-sky-700"
                    >
                      {baseline.name || 'Sin nombre'}
                    </button>
                    {baseline.description ? (
                      <div className="text-xs text-slate-500">{baseline.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(baseline.created_at)}</td>
                  <td className="px-3 py-2 text-slate-600">{baseline.wbs_count ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{baseline.activity_count ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onSelect(baseline.id)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(baseline)}
                        className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
