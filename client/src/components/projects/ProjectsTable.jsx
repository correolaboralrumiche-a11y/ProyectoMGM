function formatDateTime(value) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatusChip({ value }) {
  const normalized = String(value || '').trim().toLowerCase();
  const toneClass =
    normalized === 'active'
      ? 'erp-chip erp-chip-success'
      : normalized === 'closed' || normalized === 'inactive'
        ? 'erp-chip erp-chip-neutral'
        : normalized === 'on_hold' || normalized === 'hold'
          ? 'erp-chip erp-chip-warning'
          : 'erp-chip erp-chip-info';

  return <span className={toneClass}>{value || '—'}</span>;
}

export default function ProjectsTable({
  projects,
  activeProjectId,
  onSelect,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
}) {
  if (!projects.length) {
    return <div className="erp-empty-state">No hay proyectos registrados.</div>;
  }

  return (
    <div className="erp-data-panel overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th className="w-28">Activo</th>
            <th>Nombre</th>
            <th>Descripción</th>
            <th className="w-40">Estado</th>
            <th className="w-40">Creado</th>
            <th className="w-44">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;

            return (
              <tr
                key={project.id}
                aria-selected={isActive ? 'true' : 'false'}
                className={isActive ? 'data-active-row' : ''}
              >
                <td>
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className={[
                      'min-w-[92px]',
                      isActive
                        ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700'
                        : '',
                    ].join(' ')}
                  >
                    {isActive ? 'Activo' : 'Seleccionar'}
                  </button>
                </td>
                <td>
                  <div className="font-semibold text-slate-900">{project.name}</div>
                </td>
                <td className="max-w-[340px] text-slate-600">
                  {project.description || '—'}
                </td>
                <td>
                  <StatusChip
                    value={project.status_name || project.status_code || project.status}
                  />
                </td>
                <td className="whitespace-nowrap text-slate-500">
                  {formatDateTime(project.created_at)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <button type="button" onClick={() => onEdit(project)}>
                        Editar
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(project)}
                        className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      >
                        Eliminar
                      </button>
                    ) : null}
                    {!canEdit && !canDelete ? (
                      <span className="text-xs text-slate-400">Sin acciones</span>
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
