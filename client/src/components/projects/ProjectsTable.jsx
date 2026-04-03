function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getPriorityBadgeClass(code) {
  const normalized = String(code || '').toLowerCase();
  if (normalized === 'critical') return 'bg-rose-100 text-rose-700';
  if (normalized === 'high') return 'bg-amber-100 text-amber-700';
  if (normalized === 'medium') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
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
    return <div className="text-sm text-slate-600">No hay proyectos registrados.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Activo</th>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Descripción</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Prioridad</th>
            <th className="px-4 py-3 font-medium">Moneda</th>
            <th className="px-4 py-3 font-medium">Creado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <tr key={project.id} className={isActive ? 'bg-blue-50/40' : ''}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className={[
                      'rounded-md px-2 py-1 text-xs font-medium',
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {isActive ? 'Activo' : 'Seleccionar'}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-900">{project.name}</td>
                <td className="px-4 py-3 text-slate-700">{project.description || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{project.status_name || project.status_code || project.status || '—'}</td>
                <td className="px-4 py-3 text-slate-700">
                  <span className={['rounded-full px-2 py-1 text-xs font-medium', getPriorityBadgeClass(project.priority_code)].join(' ')}>
                    {project.priority_name || project.priority_code || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{project.currency_code || project.currency_name || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(project.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <button type="button" onClick={() => onEdit(project)} className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                        Editar
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" onClick={() => onDelete(project)} className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
                        Eliminar
                      </button>
                    ) : null}
                    {!canEdit && !canDelete ? <span className="text-xs text-slate-400">Sin acciones</span> : null}
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
