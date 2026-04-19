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
  if (loading) {
    return <div className="erp-empty-state">Cargando líneas base...</div>;
  }

  if (!baselines.length) {
    return <div className="erp-empty-state">No hay líneas base registradas.</div>;
  }

  return (
    <div className="erp-data-panel overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Línea base</th>
            <th className="w-44">Creada</th>
            <th className="w-28">WBS</th>
            <th className="w-28">Actividades</th>
            <th className="w-36">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {baselines.map((baseline) => {
            const isSelected = baseline.id === selectedBaselineId;

            return (
              <tr
                key={baseline.id}
                aria-selected={isSelected ? 'true' : 'false'}
                className={isSelected ? 'data-selected-row' : ''}
              >
                <td>
                  <button
                    type="button"
                    onClick={() => onSelect(baseline.id)}
                    className="border-0 bg-transparent px-0 py-0 text-left shadow-none hover:bg-transparent"
                  >
                    <div className="font-semibold text-slate-900 hover:text-sky-700">
                      {baseline.name || 'Sin nombre'}
                    </div>
                    {baseline.description ? (
                      <div className="mt-1 text-xs text-slate-500">{baseline.description}</div>
                    ) : null}
                  </button>
                </td>
                <td className="whitespace-nowrap text-slate-500">
                  {formatDateTime(baseline.created_at)}
                </td>
                <td>{baseline.wbs_count ?? '—'}</td>
                <td>{baseline.activity_count ?? '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onSelect(baseline.id)}>
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(baseline)}
                      className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    >
                      Eliminar
                    </button>
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
