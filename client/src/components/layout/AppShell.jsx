export default function AppShell({ children, user, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">ProyectoMGM</h1>
            <p className="mt-1 text-sm text-slate-600">ERP ligero para control de entregables</p>
          </div>

          {user ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm md:items-end">
              <div>
                <div className="font-medium text-slate-900">{user.full_name || user.username}</div>
                <div className="text-slate-600">{user.username}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {(user.roles || []).join(', ') || 'sin rol'}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}
