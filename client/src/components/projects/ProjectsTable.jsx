export default function ProjectsTable({ projects, activeProjectId, onSelect, onEdit, onDelete }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Activo</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Nombre</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Descripción</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Creado</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;

            return (
              <tr key={project.id} className={isActive ? 'bg-blue-50' : 'bg-white'}>
                <td className="border-b border-slate-100 px-3 py-2">
                  <button
                    onClick={() => onSelect(project.id)}
                    className={[
                      'rounded-md px-2 py-1 text-xs font-medium',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {isActive ? 'Activo' : 'Seleccionar'}
                  </button>
                </td>
                <td className="border-b border-slate-100 px-3 py-2">{project.name}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{project.description}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-500">
                  {new Date(project.created_at).toLocaleString()}
                </td>
                <td className="border-b border-slate-100 px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(project)}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(project)}
                      className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {projects.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-3 py-6 text-center text-slate-500">
                No hay proyectos registrados.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
